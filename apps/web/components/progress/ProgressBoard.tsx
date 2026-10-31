"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { AddItemModal } from "./AddItemModal";
import { ItemCard } from "./ItemCard";
import type { ProgressItem, ItemType, InterviewStage, Topic } from "@/lib/progress-types";

const SECTION_TITLES: Record<ItemType, string> = {
  daily: "Daily Habits",
  study_plan: "Study Plans",
  interview: "Interviews",
  other: "Other",
};

/**
 * Owns all Progress Tracker state and mutations in one place (APPROACH.md
 * §10's generic items model) — a single "+ Add item" modal creates any
 * type, and items are grouped by type for display, each rendered by
 * ItemCard with the widget matching its type.
 */
export function ProgressBoard({ initialItems }: { initialItems: ProgressItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [modalOpen, setModalOpen] = useState(false);

  function patchItem(id: string, patch: Partial<ProgressItem>) {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleCreate(input: { type: ItemType; title: string; dueAt?: string; data?: Record<string, unknown> }) {
    const res = await fetch("/api/progress/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const item = await res.json();
    setItems((its) => [item, ...its]);
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
    patch: { title?: string; dueAt?: string | null; company?: string; role?: string },
  ) {
    patchItem(item.id, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.dueAt !== undefined ? { due_at: patch.dueAt } : {}),
      data: { ...item.data, ...(patch.company !== undefined ? { company: patch.company } : {}), ...(patch.role !== undefined ? { role: patch.role } : {}) },
    });
    const res = await fetch(`/api/progress/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated = await res.json();
    patchItem(item.id, updated);
  }

  const grouped = (["daily", "study_plan", "interview", "other"] as ItemType[]).map((type) => ({
    type,
    items: items.filter((i) => i.type === type),
  }));

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
            <p className="text-sm font-medium text-accent">{SECTION_TITLES[type]}</p>
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
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <AddItemModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
