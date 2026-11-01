"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import type { ItemType, ItemPriority } from "@/lib/progress-types";

const TYPE_OPTIONS: { value: ItemType; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "A recurring habit — POTD, revision, mock interview prep, etc. Tracked as a streak + heatmap." },
  { value: "interview", label: "Interview", hint: "A job application — Applied → Referral → Interview → Outcome, plus a prep-coverage % once scheduled." },
  { value: "study_plan", label: "Study Plan", hint: "A syllabus (e.g. GATE prep) — add topics, see a % coverage bar." },
  { value: "other", label: "Other", hint: "Anything else — pick or name a category (or leave uncategorized), optionally with a due date." },
];

const PRIORITY_OPTIONS: { value: ItemPriority; label: string; className: string }[] = [
  { value: "low", label: "Low", className: "border-slate-400/40 bg-slate-400/15 text-slate-300" },
  { value: "medium", label: "Medium", className: "border-sky-400/40 bg-sky-400/15 text-sky-300" },
  { value: "high", label: "High", className: "border-amber-400/40 bg-amber-400/15 text-amber-300" },
];

export function AddItemModal({
  open,
  onClose,
  onSubmit,
  existingCategories = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: ItemType;
    title: string;
    priority?: ItemPriority;
    dueAt?: string;
    data?: Record<string, unknown>;
  }) => Promise<void>;
  // Previously-used category names (derived from current items,
  // ProgressBoard.tsx) — quick-picks, not a fixed/managed list, since
  // categories are just whatever string you type as the type (full
  // flexibility, no separate category table/endpoint).
  existingCategories?: string[];
}) {
  const [type, setType] = useState<ItemType>("daily");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setType("daily");
    setTitle("");
    setPriority("medium");
    setDueAt("");
    setCompany("");
    setRole("");
    setJdUrl("");
    setTopics([]);
    setNewTopic("");
    setCategory("");
    setDescription("");
  }

  function addTopic() {
    const trimmed = newTopic.trim();
    if (!trimmed) return;
    setTopics((ts) => [...ts, trimmed]);
    setNewTopic("");
  }

  function removeTopic(index: number) {
    setTopics((ts) => ts.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveTitle = type === "interview" ? company : title;
    if (!effectiveTitle.trim()) return;
    const effectiveType = type === "other" && category.trim() ? category.trim() : type;

    setSubmitting(true);
    try {
      await onSubmit({
        type: effectiveType,
        title: effectiveTitle.trim(),
        priority,
        dueAt: dueAt || undefined,
        data: {
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(type === "interview"
            ? { company: company.trim(), role: role.trim() || undefined, jdUrl: jdUrl.trim() || undefined }
            : type === "study_plan"
              ? { topics }
              : {}),
        },
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

          <div>
            <label className="text-xs text-slate-400">Priority</label>
            <div className="mt-1.5 flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    priority === opt.value ? opt.className : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
              <input
                type="url"
                value={jdUrl}
                onChange={(e) => setJdUrl(e.target.value)}
                placeholder="Job description link (optional)"
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
              {type === "other" && (
                <div>
                  <label className="text-xs text-slate-400">Category (optional — leave blank for general "Other")</label>
                  {existingCategories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {existingCategories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(category === c ? "" : c)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            category === c
                              ? "border-accent/50 bg-accent/15 text-accent"
                              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Or name a new category (e.g. Side Projects)"
                    className="mt-1.5 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                </div>
              )}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "daily" ? "Habit name (e.g. LeetCode POTD)" : type === "study_plan" ? "Plan name (e.g. GATE Prep)" : "Title"
                }
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus={type !== "other"}
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
              {type === "study_plan" && (
                <div>
                  <label className="text-xs text-slate-400">Topics (optional — add more later too)</label>
                  {topics.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {topics.map((t, i) => (
                        <li
                          key={`${t}-${i}`}
                          className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTopic(i)}
                            aria-label={`Remove ${t}`}
                            className="text-slate-400 hover:text-white"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTopic();
                        }
                      }}
                      placeholder="Topic name (e.g. OS, DBMS)"
                      className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <Button type="button" variant="ghost" className="px-4 py-2 text-sm" onClick={addTopic}>
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes / description (optional)"
            rows={2}
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />

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
