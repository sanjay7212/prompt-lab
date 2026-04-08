import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { AppConfig, TokenUsage } from "@/lib/types";

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return process.env[varName] || value;
  });
}

function getConfig(): AppConfig {
  const configPath = path.join(process.cwd(), "config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

type ContentBlock = {
  type: string;
  text?: string;
  id?: string;
  content?: unknown;
  input?: unknown;
  tool_use_id?: string;
};

async function callClaude(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  webSearch: boolean,
  onChunk: (text: string) => void
): Promise<TokenUsage> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt) body.system = systemPrompt;
  if (webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  let currentMessages = body.messages as Array<{ role: string; content: unknown }>;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let iter = 0; iter < 10; iter++) {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, messages: currentMessages }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error (${res.status}): ${err}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stopReason = "";
    const contentBlocks: ContentBlock[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;
        let event: Record<string, unknown>;
        try { event = JSON.parse(dataStr); } catch { continue; }

        switch (event.type) {
          case "message_start": {
            const msg = event.message as { usage?: { input_tokens?: number } };
            inputTokens = msg?.usage?.input_tokens || 0;
            break;
          }
          case "content_block_start": {
            const idx = event.index as number;
            const block = event.content_block as ContentBlock;
            contentBlocks[idx] = {
              type: block.type,
              id: block.id,
              text: block.type === "text" ? "" : undefined,
              input: (block.type === "tool_use" || block.type === "server_tool_use") ? "" : undefined,
              content: block.content,
              tool_use_id: block.tool_use_id,
            };
            break;
          }
          case "content_block_delta": {
            const idx = event.index as number;
            const b = contentBlocks[idx];
            if (!b) break;
            const delta = event.delta as { type: string; text?: string; partial_json?: string };
            if (delta.type === "text_delta" && delta.text) {
              b.text = (b.text || "") + delta.text;
              onChunk(delta.text);
            } else if (delta.type === "input_json_delta" && delta.partial_json) {
              b.input = ((b.input as string) || "") + delta.partial_json;
            }
            break;
          }
          case "message_delta": {
            const delta = event.delta as { stop_reason?: string };
            stopReason = delta?.stop_reason || "";
            const usage = event.usage as { output_tokens?: number };
            outputTokens = usage?.output_tokens || 0;
            break;
          }
        }
      }
    }

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    if (stopReason === "tool_use") {
      const toolResultsInResponse = contentBlocks.filter(
        (b) => b?.type === "tool_result" || b?.type === "web_search_tool_result"
      );
      const toolUseBlocks = contentBlocks.filter(
        (b) => b?.type === "tool_use" || b?.type === "server_tool_use"
      );

      const userContent =
        toolResultsInResponse.length > 0
          ? toolResultsInResponse
          : toolUseBlocks.map((b) => ({
              type: "tool_result",
              tool_use_id: b.id,
              content: "",
            }));

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: contentBlocks.filter(Boolean) },
        { role: "user", content: userContent },
      ];
    } else {
      return {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      };
    }
  }

  throw new Error("Max iterations reached in Claude tool-use loop");
}

async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  _webSearch: boolean,
  onChunk: (text: string) => void
): Promise<TokenUsage> {
  const allMessages: unknown[] = [];
  if (systemPrompt) allMessages.push({ role: "system", content: systemPrompt });
  allMessages.push(...messages);

  // web_search_preview is not supported by the Vocareum proxy (only 'function' and 'custom' are)
  const body: Record<string, unknown> = {
    model,
    max_completion_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true },
  };

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, messages: allMessages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]") continue;
      let event: Record<string, unknown>;
      try { event = JSON.parse(dataStr); } catch { continue; }

      const choices = event.choices as Array<{ delta: { content?: string } }> | undefined;
      const content = choices?.[0]?.delta?.content;
      if (content) onChunk(content);

      const usage = event.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      if (usage) {
        promptTokens = usage.prompt_tokens || 0;
        completionTokens = usage.completion_tokens || 0;
        totalTokens = usage.total_tokens || (promptTokens + completionTokens);
      }
    }
  }

  return { inputTokens: promptTokens, outputTokens: completionTokens, totalTokens };
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  webSearch: boolean,
  onChunk: (text: string) => void
): Promise<TokenUsage> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  if (webSearch) body.tools = [{ google_search: {} }];

  const res = await fetch(
    `${baseUrl}/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;
      let event: Record<string, unknown>;
      try { event = JSON.parse(dataStr); } catch { continue; }

      const candidates = event.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      const text = candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) onChunk(text);

      const usage = event.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
      if (usage) {
        inputTokens = usage.promptTokenCount || 0;
        outputTokens = usage.candidatesTokenCount || 0;
        totalTokens = usage.totalTokenCount || 0;
      }
    }
  }

  return { inputTokens, outputTokens, totalTokens };
}

export async function POST(request: NextRequest) {
  const { provider, model, systemPrompt, messages, webSearch } = await request.json();

  const config = getConfig();
  const providerConfig = config.providers[provider];
  if (!providerConfig) {
    return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = resolveEnvVars(providerConfig.apiKey);
  if (!apiKey || apiKey.startsWith("$")) {
    return new Response(
      JSON.stringify({ error: `API key not configured for ${provider}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const chatMessages = messages.filter((m: { role: string }) => m.role !== "system");
  const useWebSearch = webSearch === true;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const onChunk = (text: string) => enqueue({ type: "chunk", text });
        let tokenUsage: TokenUsage;

        switch (provider) {
          case "claude":
            tokenUsage = await callClaude(
              providerConfig.baseUrl, apiKey, model, systemPrompt || "",
              chatMessages, useWebSearch, onChunk
            );
            break;
          case "openai":
            tokenUsage = await callOpenAI(
              providerConfig.baseUrl, apiKey, model, systemPrompt || "",
              chatMessages, useWebSearch, onChunk
            );
            break;
          case "gemini":
            tokenUsage = await callGemini(
              providerConfig.baseUrl, apiKey, model, systemPrompt || "",
              chatMessages, useWebSearch, onChunk
            );
            break;
          default:
            enqueue({ type: "error", message: `Unsupported provider: ${provider}` });
            controller.close();
            return;
        }

        enqueue({ type: "done", tokenUsage });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Chat request failed";
        enqueue({ type: "error", message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
