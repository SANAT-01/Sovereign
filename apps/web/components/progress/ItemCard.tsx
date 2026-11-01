"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { EditIcon, TrashIcon } from "../ui/icons";
import type { ProgressItem, InterviewStage, Topic, ItemPriority } from "@/lib/progress-types";

const PRIORITY_BADGES: Record<ItemPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-400/15 text-slate-300" },
  medium: { label: "Medium", className: "bg-sky-400/15 text-sky-300" },
  high: { label: "High", className: "bg-amber-400/15 text-amber-300" },
};

const PRIORITY_OPTIONS: ItemPriority[] = ["low", "medium", "high"];

function PriorityBadge({ priority }: { priority: ItemPriority }) {
  const meta = PRIORITY_BADGES[priority];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
  );
}

const STAGES: { value: InterviewStage; label: string; badge: string }[] = [
  { value: "applied", label: "Applied", badge: "bg-slate-500/20 text-slate-300" },
  { value: "referral_asked", label: "Referral", badge: "bg-sky-500/20 text-sky-300" },
  { value: "interview", label: "Interview", badge: "bg-accent/20 text-accent" },
  { value: "pending", label: "Pending", badge: "bg-amber-500/20 text-amber-300" },
  { value: "accepted", label: "Accepted", badge: "bg-emerald-500/20 text-emerald-300" },
  { value: "rejected", label: "Rejected", badge: "bg-red-500/20 text-red-300" },
];

function daysUntil(dueAt: string): number {
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}

// datetime-local / date inputs need "YYYY-MM-DDTHH:mm" / "YYYY-MM-DD" with
// no timezone — slice the ISO string down rather than reformat it.
function toInputValue(iso: string | null, withTime: boolean): string {
  if (!iso) return "";
  return withTime ? iso.slice(0, 16) : iso.slice(0, 10);
}

interface EditPatch {
  title?: string;
  priority?: ItemPriority;
  dueAt?: string | null;
  company?: string;
  role?: string;
  jdUrl?: string;
  description?: string;
}

export function ItemCard({
  item,
  onToggleDaily,
  onAddTopic,
  onUpdateTopicStatus,
  onUpdateInterview,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  item: ProgressItem;
  onToggleDaily: (item: ProgressItem) => void;
  onAddTopic: (item: ProgressItem, title: string) => void;
  onUpdateTopicStatus: (item: ProgressItem, topic: Topic) => void;
  onUpdateInterview: (item: ProgressItem, patch: { stage?: InterviewStage; coveragePercent?: number }) => void;
  onToggleDone: (item: ProgressItem) => void;
  onEdit: (item: ProgressItem, patch: EditPatch) => void;
  onDelete: (item: ProgressItem) => void;
}) {
  const [newTopic, setNewTopic] = useState("");
  const [editing, setEditing] = useState(false);

  const company = (item.data.company as string) ?? item.title;
  const role = item.data.role as string | undefined;
  const jdUrl = item.data.jdUrl as string | undefined;
  const description = item.data.description as string | undefined;

  const [editTitle, setEditTitle] = useState(item.type === "interview" ? company : item.title);
  const [editPriority, setEditPriority] = useState<ItemPriority>(item.priority);
  const [editRole, setEditRole] = useState(role ?? "");
  const [editJdUrl, setEditJdUrl] = useState(jdUrl ?? "");
  const [editDescription, setEditDescription] = useState(description ?? "");
  const [editDueAt, setEditDueAt] = useState(toInputValue(item.due_at, item.type === "interview"));

  function startEdit() {
    setEditTitle(item.type === "interview" ? company : item.title);
    setEditPriority(item.priority);
    setEditRole(role ?? "");
    setEditJdUrl(jdUrl ?? "");
    setEditDescription(description ?? "");
    setEditDueAt(toInputValue(item.due_at, item.type === "interview"));
    setEditing(true);
  }

  function saveEdit() {
    if (!editTitle.trim()) return;
    const patch: EditPatch = { dueAt: editDueAt || null, description: editDescription.trim(), priority: editPriority };
    if (item.type === "interview") {
      patch.company = editTitle.trim();
      patch.role = editRole.trim();
      patch.jdUrl = editJdUrl.trim();
    } else {
      patch.title = editTitle.trim();
    }
    onEdit(item, patch);
    setEditing(false);
  }

  const editButton = (
    <button
      type="button"
      onClick={startEdit}
      aria-label="Edit"
      className="shrink-0 text-slate-500 hover:text-slate-200"
    >
      <EditIcon width={16} height={16} />
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Delete this item? This can't be undone.")) {
          onDelete(item);
        }
      }}
      aria-label="Delete"
      className="shrink-0 text-slate-500 hover:text-red-400"
    >
      <TrashIcon width={16} height={16} />
    </button>
  );

  const editForm = editing && (
    <div className="mt-3 space-y-2 rounded-xl bg-white/5 p-3">
      <input
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        placeholder={item.type === "interview" ? "Company" : "Title"}
        className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {item.type === "interview" && (
        <>
          <input
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            placeholder="Role (optional)"
            className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="url"
            value={editJdUrl}
            onChange={(e) => setEditJdUrl(e.target.value)}
            placeholder="Job description link (optional)"
            className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </>
      )}
      {item.type !== "daily" && item.type !== "study_plan" && (
        <input
          type={item.type === "interview" ? "datetime-local" : "date"}
          value={editDueAt}
          onChange={(e) => setEditDueAt(e.target.value)}
          className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
      <div className="flex gap-1.5">
        {PRIORITY_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setEditPriority(p)}
            className={`flex-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
              editPriority === p ? PRIORITY_BADGES[p].className : "bg-white/5 text-slate-500 hover:bg-white/10"
            }`}
          >
            {PRIORITY_BADGES[p].label}
          </button>
        ))}
      </div>
      <textarea
        value={editDescription}
        onChange={(e) => setEditDescription(e.target.value)}
        placeholder="Notes / description (optional)"
        rows={2}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={saveEdit}>
          Save
        </Button>
      </div>
    </div>
  );

  const descriptionBlock = description && !editing && (
    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-400">{description}</p>
  );

  if (item.type === "daily") {
    return (
      <Card
        variant="glass"
        className={`p-4 ${!item.doneToday ? "ring-1 ring-amber-400/40 border-amber-400/30" : ""}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              <PriorityBadge priority={item.priority} />
              {!item.doneToday && (
                <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Not done today
                </span>
              )}
              {editButton}
              {deleteButton}
            </div>
            <p className="text-xs text-slate-400">
              {item.streak && item.streak > 0 ? `${item.streak} day streak` : "No streak yet"}
              {!item.doneToday && item.streak && item.streak > 0 ? " — at risk today" : ""}
            </p>
            {item.heatmap && item.heatmap.length > 0 && (
              <div className="mt-2 flex gap-0.5">
                {item.heatmap.map((day) => (
                  <span
                    key={day.date}
                    title={day.date}
                    className={`h-2.5 w-2.5 rounded-sm ${day.completed ? "bg-accent" : "bg-white/10"}`}
                  />
                ))}
              </div>
            )}
          </div>
          <Button type="button" variant={item.doneToday ? "primary" : "secondary"} onClick={() => onToggleDaily(item)}>
            {item.doneToday ? "Done today" : "Mark done"}
          </Button>
        </div>
        {descriptionBlock}
        {editForm}
      </Card>
    );
  }

  if (item.type === "study_plan") {
    const topics = Array.isArray(item.data.topics) ? (item.data.topics as Topic[]) : [];
    const pct = item.coveragePercent;
    return (
      <Card variant="glass" className="p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">{item.title}</p>
          <PriorityBadge priority={item.priority} />
          {editButton}
              {deleteButton}
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{pct === null || pct === undefined ? "No topics yet" : `${pct}% covered`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
        {topics.length > 0 && (
          <ul className="mt-3 space-y-1">
            {topics.map((topic) => (
              <li key={topic.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5">
                <span className="truncate text-xs text-slate-200">{topic.title}</span>
                <button
                  type="button"
                  onClick={() => onUpdateTopicStatus(item, topic)}
                  className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/20"
                >
                  {topic.status === "not_started" ? "Not started" : topic.status === "in_progress" ? "In progress" : "Done"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTopic.trim()) return;
            onAddTopic(item, newTopic.trim());
            setNewTopic("");
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="New topic"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button type="submit" variant="ghost" className="px-3 py-1.5 text-xs">
            Add
          </Button>
        </form>
        {descriptionBlock}
        {editForm}
      </Card>
    );
  }

  if (item.type === "interview") {
    const stage = (item.data.stage as InterviewStage) ?? "applied";
    const coverage = (item.data.coveragePercent as number) ?? 0;
    const terminal = stage === "accepted" || stage === "rejected";
    const stageMeta = STAGES.find((s) => s.value === stage)!;
    const daysLeft = item.due_at ? daysUntil(item.due_at) : null;
    const urgent = !terminal && daysLeft !== null && daysLeft <= 1;

    return (
      <Card
        variant="glass"
        className={`p-4 ${urgent ? "ring-1 ring-amber-400/40 border-amber-400/30" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-white">
                {company}
                {role ? ` — ${role}` : ""}
              </p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${stageMeta.badge}`}>
                {stageMeta.label}
              </span>
              <PriorityBadge priority={item.priority} />
            </div>
            {item.due_at && (
              <p className={`mt-1 text-xs ${urgent ? "text-amber-300" : "text-slate-400"}`}>
                {daysLeft !== null && daysLeft < 0
                  ? "Interview date passed"
                  : daysLeft === 0
                    ? "Interview is today"
                    : `Interview in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
              </p>
            )}
            {jdUrl && (
              <a
                href={jdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
              >
                View job description ↗
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {editButton}
            {deleteButton}
          </div>
        </div>

        {descriptionBlock}

        {/* Visual stepper — dots connected by a line, not same-weight
            buttons, so progress through the pipeline actually reads as
            progress. */}
        <div className="mt-4 flex items-center">
          {STAGES.filter((s) => s.value !== "accepted" && s.value !== "rejected").map((s, i, arr) => {
            const idx = STAGES.findIndex((x) => x.value === s.value);
            const currentIdx = STAGES.findIndex((x) => x.value === stage);
            const passed = currentIdx > idx || terminal;
            const current = stage === s.value;
            return (
              <div key={s.value} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => onUpdateInterview(item, { stage: s.value })}
                  title={s.label}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                    current
                      ? "bg-accent text-surface"
                      : passed
                        ? "bg-accent/30 text-accent"
                        : "bg-white/10 text-slate-500 hover:bg-white/15"
                  }`}
                >
                  {passed && !current ? "✓" : i + 1}
                </button>
                {i < arr.length - 1 && (
                  <div className={`h-0.5 flex-1 ${passed ? "bg-accent/40" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
          {STAGES.filter((s) => s.value !== "accepted" && s.value !== "rejected").map((s) => (
            <span key={s.value} className="w-6 text-center first:-ml-1 last:-mr-1">
              {s.label}
            </span>
          ))}
        </div>

        {terminal ? (
          <p className={`mt-3 text-xs font-medium ${stage === "accepted" ? "text-emerald-300" : "text-red-300"}`}>
            {stage === "accepted" ? "Accepted 🎉" : "Rejected"}
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1 px-2 py-1.5 text-xs" onClick={() => onUpdateInterview(item, { stage: "accepted" })}>
              Mark accepted
            </Button>
            <Button type="button" variant="ghost" className="flex-1 px-2 py-1.5 text-xs" onClick={() => onUpdateInterview(item, { stage: "rejected" })}>
              Mark rejected
            </Button>
          </div>
        )}

        {/* Prep coverage — only meaningful once there's an upcoming interview */}
        {!terminal && item.due_at && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Prep coverage</span>
              <span>{coverage}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={coverage}
              onChange={(e) => onUpdateInterview(item, { coveragePercent: Number(e.target.value) })}
              className="mt-1 w-full accent-accent"
            />
          </div>
        )}
        {editForm}
      </Card>
    );
  }

  // "other" and every user-defined category — generic done/due-date widget.
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-white">{item.title}</p>
            <PriorityBadge priority={item.priority} />
            {editButton}
              {deleteButton}
          </div>
          {item.due_at && (
            <p className="text-xs text-slate-400">
              Due {new Date(item.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        <Button type="button" variant={item.status === "done" ? "primary" : "ghost"} onClick={() => onToggleDone(item)}>
          {item.status === "done" ? "Done" : "Mark done"}
        </Button>
      </div>
      {descriptionBlock}
      {editForm}
    </Card>
  );
}
