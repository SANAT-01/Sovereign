"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { AddItemModal } from "./AddItemModal";
import { ItemCard } from "./ItemCard";
import type { ProgressItem, ItemType, ItemPriority, InterviewStage, Topic } from "@/lib/progress-types";

const PRIORITY_RANK: Record<ItemPriority, number> = { high: 0, medium: 1, low: 2 };

// Mirrors the backend's PRIORITY_ORDER (repository.ts) so an optimistic
// client-side insert (new item, or an edited priority) lands in the same
// position the next server fetch would give it, rather than just appending.
function sortByPriority(its: ProgressItem[]): ProgressItem[] {
  return [...its].sort((a, b) => {
    const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Fixed sections always shown (even empty, per the "don't fabricate
// progress" rule — an empty section still distinguishes "nothing tracked
// yet" from "doesn't exist"). Anything else is a user-defined category
// (full flexibility) — its section only appears once it has an item, and
// is titled by the raw string rather than a lookup.
const FIXED_TYPES: ItemType[] = ["daily", "study_plan", "interview", "other"];
const FIXED_TITLES: Record<string, string> = {
  daily: "Daily Habits",
  study_plan: "Study Plans",
  interview: "Interviews",
  other: "Other",
};
function sectionTitle(type: ItemType): string {
  return FIXED_TITLES[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

/**
 * Owns all Progress Tracker state and mutations in one place (APPROACH.md
 * §10's generic items model) — a single "+ Add item" modal creates any
 * type, and items are grouped by type for display, each rendered by
 * ItemCard with the widget matching its type.
 */
export function ProgressBoard({ initialItems }: { initialItems: ProgressItem[] }) {
  const [items, setItems] = useState(() => sortByPriority(initialItems));
  const [modalOpen, setModalOpen] = useState(false);

  function patchItem(id: string, patch: Partial<ProgressItem>) {
    setItems((its) => sortByPriority(its.map((i) => (i.id === id ? { ...i, ...patch } : i))));
  }

  async function handleCreate(input: {
    type: ItemType;
    title: string;
    priority?: ItemPriority;
    dueAt?: string;
    data?: Record<string, unknown>;
  }) {
    const res = await fetch("/api/progress/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const item = await res.json();
    setItems((its) => sortByPriority([item, ...its]));
  }

  async function handleToggleDaily(item: ProgressItem) {
    const done = !item.doneToday;
    patchItem(item.id, {
      doneToday: done,
      streak: done ? (item.streak ?? 0) + 1 : Math.max(0, (item.streak ?? 0) - 1),
    });
    await fetch(`/api/progress/items/${item.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  }

  async function handleAddTopic(item: ProgressItem, title: string) {
    const res = await fetch(`/api/progress/items/${item.id}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  async function handleUpdateTopicStatus(item: ProgressItem, topic: Topic) {
    const cycle = { not_started: "in_progress", in_progress: "done", done: "not_started" } as const;
    const next = cycle[topic.status];
    const res = await fetch(`/api/progress/items/${item.id}/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  async function handleUpdateInterview(item: ProgressItem, patch: { stage?: InterviewStage; coveragePercent?: number }) {
    patchItem(item.id, { data: { ...item.data, ...patch } });
    const res = await fetch(`/api/progress/items/${item.id}/interview`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  async function handleToggleDone(item: ProgressItem) {
    const done = item.status !== "done";
    patchItem(item.id, { status: done ? "done" : "active" });
    const res = await fetch(`/api/progress/items/${item.id}/done`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  async function handleEdit(
    item: ProgressItem,
    patch: {
      title?: string;
      priority?: ItemPriority;
      dueAt?: string | null;
      company?: string;
      role?: string;
      jdUrl?: string;
      description?: string;
    },
  ) {
    patchItem(item.id, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.dueAt !== undefined ? { due_at: patch.dueAt } : {}),
      data: {
        ...item.data,
        ...(patch.company !== undefined ? { company: patch.company } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.jdUrl !== undefined ? { jdUrl: patch.jdUrl } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      },
    });
    const res = await fetch(`/api/progress/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  async function handleDelete(item: ProgressItem) {
    setItems((its) => its.filter((i) => i.id !== item.id));
    await fetch(`/api/progress/items/${item.id}`, { method: "DELETE" });
  }

  const customCategories = Array.from(new Set(items.map((i) => i.type)))
    .filter((t) => !FIXED_TYPES.includes(t))
    .sort((a, b) => a.localeCompare(b));

  const grouped = [...FIXED_TYPES, ...customCategories].map((type) => ({
    type,
    items: items.filter((i) => i.type === type),
  }));

  // Quick-pick suggestions in the "Add item" modal — any custom category
  // already in use, so you can reuse "Side Projects" without retyping it.
  const existingCategories = customCategories;

  return (
    <div>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setModalOpen(true)}>
          + Add item
        </Button>
      </div>

      <div className="mt-4 space-y-8">
        {grouped.map(({ type, items: typeItems }) => (
          <div key={type}>
            <p className="text-sm font-medium text-accent">{sectionTitle(type)}</p>
            {typeItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nothing here yet.</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {typeItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onToggleDaily={handleToggleDaily}
                    onAddTopic={handleAddTopic}
                    onUpdateTopicStatus={handleUpdateTopicStatus}
                    onUpdateInterview={handleUpdateInterview}
                    onToggleDone={handleToggleDone}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <AddItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        existingCategories={existingCategories}
      />
    </div>
  );
}
