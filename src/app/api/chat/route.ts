import { NextRequest, NextResponse } from "next/server";
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

async function callClaude(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<{ content: string; tokenUsage: TokenUsage }> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text || "",
    tokenUsage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<{ content: string; tokenUsage: TokenUsage }> {
  const allMessages = [];
  if (systemPrompt) {
    allMessages.push({ role: "system", content: systemPrompt });
  }
  allMessages.push(...messages);

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: allMessages, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    tokenUsage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<{ content: string; tokenUsage: TokenUsage }> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(
    `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata || {};
  return {
    content: text,
    tokenUsage: {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { provider, model, systemPrompt, messages } = await request.json();

    const config = getConfig();
    const providerConfig = config.providers[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const apiKey = resolveEnvVars(providerConfig.apiKey);
    if (!apiKey || apiKey.startsWith("$")) {
      return NextResponse.json(
        { error: `API key not configured for ${provider}` },
        { status: 400 }
      );
    }

    const chatMessages = messages.filter((m: { role: string }) => m.role !== "system");

    let result;
    switch (provider) {
      case "claude":
        result = await callClaude(providerConfig.baseUrl, apiKey, model, systemPrompt || "", chatMessages);
        break;
      case "openai":
        result = await callOpenAI(providerConfig.baseUrl, apiKey, model, systemPrompt || "", chatMessages);
        break;
      case "gemini":
        result = await callGemini(providerConfig.baseUrl, apiKey, model, systemPrompt || "", chatMessages);
        break;
      default:
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Chat request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
