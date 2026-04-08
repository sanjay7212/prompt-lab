"use client";

import { useState, useEffect } from "react";
import { INSTRUCTION_STEPS } from "@/lib/instructions";
import { InstructionsProgress } from "@/lib/types";

interface InstructionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionPanel({ isOpen, onClose }: InstructionPanelProps) {
  const [progress, setProgress] = useState<InstructionsProgress>({});

  useEffect(() => {
    fetch("/api/instructions")
      .then((r) => r.json())
      .then(setProgress)
      .catch(() => {});
  }, []);

  const toggleStep = async (stepId: string) => {
    const updated = { ...progress, [stepId]: !progress[stepId] };
    setProgress(updated);
    await fetch("/api/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  const completedCount = INSTRUCTION_STEPS.filter((s) => progress[s.id]).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-[var(--border)] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-[var(--border)] p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Getting Started Guide</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {completedCount} of {INSTRUCTION_STEPS.length} steps completed
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-4">
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--success)] transition-all duration-300 rounded-full"
              style={{
                width: `${(completedCount / INSTRUCTION_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {INSTRUCTION_STEPS.map((step) => (
            <div
              key={step.id}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                progress[step.id]
                  ? "border-[var(--success)]/30 bg-green-50"
                  : "border-[var(--border)] bg-white hover:border-[var(--accent)]/40 hover:shadow-sm"
              }`}
              onClick={() => toggleStep(step.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    progress[step.id]
                      ? "bg-[var(--success)] border-[var(--success)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  {progress[step.id] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3
                    className={`text-sm font-semibold ${
                      progress[step.id] ? "text-[var(--success)] line-through" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
