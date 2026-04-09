"use client";

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Conversation, Message } from "@/lib/types";

export interface ChatPanelHandle {
  sendMessage: (text: string, systemPrompt: string, webSearchOverride?: boolean) => Promise<void>;
  getProvider: () => string;
  getModel: () => string;
}

interface ChatPanelProps {
  panelId: number;
  conversation: Conversation | null;
  providers: Record<string, { models: string[] }>;
  onConversationUpdate: (conversation: Conversation) => void;
  onNewConversation: (provider: string, model: string) => Conversation;
  onClose?: () => void;
  hideInput?: boolean;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(
  {
    panelId,
    conversation,
    providers,
    onConversationUpdate,
    onNewConversation,
    onClose,
    hideInput,
  },
  ref
) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(
    conversation?.provider || Object.keys(providers)[0] || "claude"
  );
  const [selectedModel, setSelectedModel] = useState(
    conversation?.model || providers[selectedProvider]?.models[0] || ""
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  useEffect(() => {
    if (conversation) {
      setSelectedProvider(conversation.provider);
      setSelectedModel(conversation.model);
    }
  }, [conversation?.id]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const models = providers[provider]?.models || [];
    setSelectedModel(models[0] || "");
  };

  const availableModels = providers[selectedProvider]?.models || [];

  const doSend = async (text: string, systemPromptOverride?: string, webSearchOverride?: boolean) => {
    if (!text.trim() || loading) return;

    const useWebSearch = webSearchOverride !== undefined ? webSearchOverride : webSearch;

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    let conv = conversation;
    if (!conv) {
      conv = onNewConversation(selectedProvider, selectedModel);
    }

    const systemPrompt = systemPromptOverride !== undefined ? systemPromptOverride : conv.systemPrompt;

    const updatedMessages = [...conv.messages, userMessage];
    const updatedConv: Conversation = {
      ...conv,
      provider: selectedProvider,
      model: selectedModel,
      systemPrompt,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: conv.messages.length === 0 ? text.trim().slice(0, 50) : conv.title,
    };
    onConversationUpdate(updatedConv);
    setInput("");
    setLoading(true);
    setError(null);

    const streamingMsg: Message = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      webSearchEnabled: useWebSearch,
    };

    const updateMsg = (content: string, tokenUsage?: import("@/lib/types").TokenUsage) => {
      onConversationUpdate({
        ...updatedConv,
        messages: [...updatedMessages, { ...streamingMsg, content, tokenUsage }],
        updatedAt: Date.now(),
      });
    };

    let receivedText = "";
    let displayedLength = 0;
    let streamFinished = false;
    let finalTokenUsage: import("@/lib/types").TokenUsage | undefined;
    let streamError: string | null = null;

    const typewriterInterval = setInterval(() => {
      if (displayedLength < receivedText.length) {
        displayedLength++;
        updateMsg(receivedText.slice(0, displayedLength));
      } else if (streamFinished) {
        clearInterval(typewriterInterval);
        if (streamError) {
          setError(streamError);
        } else {
          updateMsg(receivedText, finalTokenUsage);
        }
        setLoading(false);
        setStreaming(false);
      }
    }, 15);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          systemPrompt,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          webSearch: useWebSearch,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Request failed");
      }

      setStreaming(true);
      updateMsg("");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; text?: string; tokenUsage?: import("@/lib/types").TokenUsage; message?: string };
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "chunk" && event.text) {
            receivedText += event.text;
          } else if (event.type === "done") {
            finalTokenUsage = event.tokenUsage;
          } else if (event.type === "error") {
            throw new Error(event.message || "Stream error");
          }
        }
      }
    } catch (err: unknown) {
      streamError = err instanceof Error ? err.message : "Request failed";
    }

    streamFinished = true;
  };

  const handleSend = () => doSend(input);

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string, systemPrompt: string, webSearchOverride?: boolean) =>
      doSend(text, systemPrompt, webSearchOverride),
    getProvider: () => selectedProvider,
    getModel: () => selectedModel,
  }));

  const messages = conversation?.messages || [];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-[var(--border)] shadow-[var(--shadow)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] rounded-t-xl">
        <select
          value={selectedProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="bg-white text-sm text-[var(--text-primary)] rounded-md px-2.5 py-1.5 border border-[var(--border)] outline-none focus:border-[var(--accent)] font-medium"
        >
          {Object.keys(providers).map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-white text-sm text-[var(--text-primary)] rounded-md px-2.5 py-1.5 border border-[var(--border)] outline-none focus:border-[var(--accent)] flex-1 min-w-0"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0 px-2 py-1 rounded-md transition-colors ${
          webSearch
            ? "bg-[var(--accent-light)] text-[var(--accent)] font-medium"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}>
          <input
            type="checkbox"
            checked={webSearch}
            onChange={(e) => setWebSearch(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
          />
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </label>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--error)] w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[var(--text-secondary)] mt-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-base font-medium text-[var(--text-primary)] mb-1">Start a conversation</p>
            <p className="text-sm">
              Select a provider and model, then type your prompt below.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[var(--user-bubble)] text-white"
                  : "bg-[var(--assistant-bubble)] text-[var(--text-primary)]"
              }`}
            >
              <div className="message-content text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
              {msg.tokenUsage && (
                <div className={`mt-2 pt-2 border-t flex gap-3 text-xs ${
                  msg.role === "user"
                    ? "border-white/20 text-white/70"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}>
                  <span>In: {msg.tokenUsage.inputTokens.toLocaleString()}</span>
                  <span>Out: {msg.tokenUsage.outputTokens.toLocaleString()}</span>
                  <span className={`font-semibold ${
                    msg.role === "user" ? "text-white/90" : "text-[var(--accent)]"
                  }`}>
                    Total: {msg.tokenUsage.totalTokens.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && !streaming && (
          <div className="flex justify-start">
            <div className="bg-[var(--assistant-bubble)] rounded-2xl px-4 py-3 text-sm text-[var(--text-secondary)]">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: "0.15s" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - only shown when not using shared input */}
      {!hideInput && (
        <div className="p-4 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your prompt... (Enter to send, Shift+Enter for new line)"
              className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-3 border border-[var(--border)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 resize-none placeholder:text-[var(--text-secondary)]"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-semibold self-end transition-colors shadow-sm"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatPanel;
