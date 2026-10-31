"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import type { ItemType } from "@/lib/progress-types";

const TYPE_OPTIONS: { value: ItemType; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "A recurring habit — POTD, revision, mock interview prep, etc. Tracked as a streak + heatmap." },
  { value: "interview", label: "Interview", hint: "A job application — Applied → Referral → Interview → Outcome, plus a prep-coverage % once scheduled." },
  { value: "study_plan", label: "Study Plan", hint: "A syllabus (e.g. GATE prep) — add topics, see a % coverage bar." },
  { value: "other", label: "Other", hint: "Anything else — a simple to-do, optionally with a due date." },
];

export function AddItemModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { type: ItemType; title: string; dueAt?: string; data?: Record<string, unknown> }) => Promise<void>;
}) {
  const [type, setType] = useState<ItemType>("daily");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setType("daily");
    setTitle("");
    setDueAt("");
    setCompany("");
    setRole("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveTitle = type === "interview" ? company : title;
    if (!effectiveTitle.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        title: effectiveTitle.trim(),
        dueAt: dueAt || undefined,
        data: type === "interview" ? { company: company.trim(), role: role.trim() || undefined } : undefined,
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface-card/95 p-6 shadow-xl backdrop-blur-xl">
        <p className="text-base font-semibold text-white">Add item</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  type === opt.value
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">{TYPE_OPTIONS.find((o) => o.value === type)?.hint}</p>

          {type === "interview" ? (
            <>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company"
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Role (optional)"
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div>
                <label className="text-xs text-slate-400">Interview date (optional)</label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "daily" ? "Habit name (e.g. LeetCode POTD)" : type === "study_plan" ? "Plan name (e.g. GATE Prep)" : "Title"
                }
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
              {type === "other" && (
                <div>
                  <label className="text-xs text-slate-400">Due date (optional)</label>
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
