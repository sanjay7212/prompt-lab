"use client";

import { Conversation } from "@/lib/types";

interface SidebarProps {
  conversations: Conversation[];
  activeIds: (string | null)[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function Sidebar({
  conversations,
  activeIds,
  onSelect,
  onDelete,
  onNew,
}: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={onNew}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium py-2.5 rounded-lg transition-colors shadow-sm"
        >
          + New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)] text-center mt-4 px-2">
            No conversations yet. Start typing to create one.
          </p>
        )}
        {conversations.map((conv) => {
          const isActive = activeIds.includes(conv.id);
          return (
            <div
              key={conv.id}
              className={`group flex items-center rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                isActive
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
              }`}
              onClick={() => onSelect(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isActive ? "font-medium" : ""}`}>
                  {conv.title || "Untitled"}
                </p>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  {conv.provider}/{conv.model.split("-").slice(0, 2).join("-")}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--error)] ml-2 text-sm transition-opacity"
                title="Delete conversation"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
