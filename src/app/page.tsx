"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "@/lib/types";
import ChatPanel, { ChatPanelHandle } from "@/components/ChatPanel";
import Sidebar from "@/components/Sidebar";
import InstructionPanel from "@/components/InstructionPanel";
import SettingsModal from "@/components/SettingsModal";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [providers, setProviders] = useState<Record<string, { models: string[] }>>({});
  const [panels, setPanels] = useState<{ conversationId: string | null }[]>([
    { conversationId: null },
  ]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sharedSystemPrompt, setSharedSystemPrompt] = useState("");
  const [sharedInput, setSharedInput] = useState("");
  const [sharedWebSearch, setSharedWebSearch] = useState(true);
  const [sendingBoth, setSendingBoth] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const panelRefs = useRef<(ChatPanelHandle | null)[]>([null, null]);

  useEffect(() => {
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/conversations").then((r) => r.json()),
    ]).then(([config, convs]) => {
      setProviders(config);
      setConversations(convs);
      setLoaded(true);
    });
  }, []);

  const saveConversation = useCallback(async (conv: Conversation) => {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conv),
    });
  }, []);

  const handleConversationUpdate = useCallback(
    (panelIndex: number) => (conv: Conversation) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = conv;
          return updated;
        }
        return [conv, ...prev];
      });
      setPanels((prev) => {
        const updated = [...prev];
        updated[panelIndex] = { conversationId: conv.id };
        return updated;
      });
      saveConversation(conv);
    },
    [saveConversation]
  );

  const handleNewConversation = useCallback(
    (panelIndex: number) => (provider: string, model: string): Conversation => {
      const conv: Conversation = {
        id: uuidv4(),
        title: "",
        provider,
        model,
        systemPrompt: sharedSystemPrompt,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations((prev) => [conv, ...prev]);
      setPanels((prev) => {
        const updated = [...prev];
        updated[panelIndex] = { conversationId: conv.id };
        return updated;
      });
      return conv;
    },
    [sharedSystemPrompt]
  );

  const handleSelectConversation = (id: string) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[0] = { conversationId: id };
      return updated;
    });
  };

  const handleDeleteConversation = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setPanels((prev) =>
      prev.map((p) => (p.conversationId === id ? { conversationId: null } : p))
    );
  };

  const handleNewClick = () => {
    setPanels((prev) => prev.map(() => ({ conversationId: null })));
  };

  const addPanel = () => {
    if (panels.length < 2) {
      setPanels((prev) => [...prev, { conversationId: null }]);
    }
  };

  const removePanel = (index: number) => {
    if (panels.length > 1) {
      setPanels((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const getConversation = (id: string | null) =>
    id ? conversations.find((c) => c.id === id) || null : null;

  const handleSaveSystemPrompt = (systemPrompt: string) => {
    setSharedSystemPrompt(systemPrompt);
    panels.forEach((panel, index) => {
      const conv = getConversation(panel.conversationId);
      if (conv) {
        const updated = { ...conv, systemPrompt, updatedAt: Date.now() };
        handleConversationUpdate(index)(updated);
      }
    });
  };

  const handleSendToBoth = async () => {
    if (!sharedInput.trim() || sendingBoth) return;
    const text = sharedInput.trim();
    setSharedInput("");
    setSendingBoth(true);

    const promises = panels.map((_, i) => {
      const ref = panelRefs.current[i];
      if (ref) {
        return ref.sendMessage(text, sharedSystemPrompt, sharedWebSearch);
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
    setSendingBoth(false);
  };

  const isDualPanel = panels.length === 2;

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top header */}
      <header className="h-14 bg-white border-b border-[var(--border)] flex items-center px-5 justify-between flex-shrink-0 shadow-sm">
        <h1 className="text-base font-bold text-[var(--text-primary)]">
          Prompt Engineering Lab
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors border ${
              sharedSystemPrompt
                ? "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/20 hover:bg-orange-100"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            System Prompt
          </button>
          {panels.length < 2 && (
            <button
              onClick={addPanel}
              className="text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 rounded-lg transition-colors font-medium border border-[var(--border)]"
            >
              + Add Panel
            </button>
          )}
          <button
            onClick={() => setShowInstructions(true)}
            className="text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 rounded-lg transition-colors font-medium border border-[var(--border)]"
          >
            <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Guide
          </button>
        </div>
      </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Conversation sidebar */}
          <Sidebar
            conversations={conversations}
            activeIds={panels.map((p) => p.conversationId)}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onNew={handleNewClick}
          />

          {/* Panels area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-secondary)]">
            {/* Chat panels */}
            <div className="flex-1 flex gap-3 p-3 overflow-hidden">
              {panels.map((panel, index) => (
                <div key={index} className="flex-1 flex flex-col min-w-0">
                  <div className="flex-1 min-h-0">
                    <ChatPanel
                      ref={(el) => { panelRefs.current[index] = el; }}
                      panelId={index + 1}
                      conversation={getConversation(panel.conversationId)}
                      providers={providers}
                      onConversationUpdate={handleConversationUpdate(index)}
                      onNewConversation={handleNewConversation(index)}
                      onClose={panels.length > 1 ? () => removePanel(index) : undefined}
                      hideInput={isDualPanel}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Shared input bar for dual panel mode */}
            {isDualPanel && (
              <div className="border-t border-[var(--border)] bg-white p-4">
                <div className="flex gap-3 items-end max-w-4xl mx-auto">
                  <textarea
                    value={sharedInput}
                    onChange={(e) => setSharedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendToBoth();
                      }
                    }}
                    placeholder="Type your prompt to send to both panels... (Enter to send)"
                    className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-3 border border-[var(--border)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 resize-none placeholder:text-[var(--text-secondary)]"
                    rows={2}
                    disabled={sendingBoth}
                  />
                  <div className="flex flex-col gap-2 items-stretch">
                    <label className={`flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1.5 rounded-lg border transition-colors ${
                      sharedWebSearch
                        ? "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/20 font-medium"
                        : "text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                    }`}>
                      <input
                        type="checkbox"
                        checked={sharedWebSearch}
                        onChange={(e) => setSharedWebSearch(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                      />
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                      </svg>
                    </label>
                    <button
                      onClick={handleSendToBoth}
                      disabled={sendingBoth || !sharedInput.trim()}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
                    >
                      Send to Both
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Instruction Panel */}
      <InstructionPanel
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        systemPrompt={sharedSystemPrompt}
        onSave={handleSaveSystemPrompt}
      />
    </div>
  );
}
