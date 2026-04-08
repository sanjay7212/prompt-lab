"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSave: (systemPrompt: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  systemPrompt,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(systemPrompt);

  useEffect(() => {
    setDraft(systemPrompt);
  }, [systemPrompt, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-[var(--border)] rounded-2xl w-full max-w-lg mx-4 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">System Prompt Settings</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          The system prompt is sent with every message to guide the AI&apos;s behavior. Changes apply to all active conversations.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g., You are a helpful coding tutor. Always provide examples and explain concepts step by step."
          className="w-full h-40 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-3 border border-[var(--border)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 resize-none placeholder:text-[var(--text-secondary)]"
        />
        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-5 py-2.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-semibold transition-colors shadow-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
