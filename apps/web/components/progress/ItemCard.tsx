"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { EditIcon } from "../ui/icons";
import type { ProgressItem, InterviewStage, Topic } from "@/lib/progress-types";

const STAGES: { value: InterviewStage; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "referral_asked", label: "Referral" },
  { value: "interview", label: "Interview" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
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
  dueAt?: string | null;
  company?: string;
  role?: string;
}

export function ItemCard({
  item,
  onToggleDaily,
  onAddTopic,
  onUpdateTopicStatus,
  onUpdateInterview,
  onToggleDone,
  onEdit,
}: {
  item: ProgressItem;
  onToggleDaily: (item: ProgressItem) => void;
  onAddTopic: (item: ProgressItem, title: string) => void;
  onUpdateTopicStatus: (item: ProgressItem, topic: Topic) => void;
  onUpdateInterview: (item: ProgressItem, patch: { stage?: InterviewStage; coveragePercent?: number }) => void;
  onToggleDone: (item: ProgressItem) => void;
  onEdit: (item: ProgressItem, patch: EditPatch) => void;
}) {
  const [newTopic, setNewTopic] = useState("");
  const [editing, setEditing] = useState(false);

  const company = (item.data.company as string) ?? item.title;
  const role = item.data.role as string | undefined;

  const [editTitle, setEditTitle] = useState(item.type === "interview" ? company : item.title);
  const [editRole, setEditRole] = useState(role ?? "");
  const [editDueAt, setEditDueAt] = useState(toInputValue(item.due_at, item.type === "interview"));

  function startEdit() {
    setEditTitle(item.type === "interview" ? company : item.title);
    setEditRole(role ?? "");
    setEditDueAt(toInputValue(item.due_at, item.type === "interview"));
    setEditing(true);
  }

  function saveEdit() {
    if (!editTitle.trim()) return;
    const patch: EditPatch = { dueAt: editDueAt || null };
    if (item.type === "interview") {
      patch.company = editTitle.trim();
      patch.role = editRole.trim();
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

  const editForm = editing && (
    <div className="mt-3 space-y-2 rounded-xl bg-white/5 p-3">
      <input
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        placeholder={item.type === "interview" ? "Company" : "Title"}
        className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {item.type === "interview" && (
        <input
          value={editRole}
          onChange={(e) => setEditRole(e.target.value)}
          placeholder="Role (optional)"
          className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
      {(item.type === "interview" || item.type === "other") && (
        <input
          type={item.type === "interview" ? "datetime-local" : "date"}
          value={editDueAt}
          onChange={(e) => setEditDueAt(e.target.value)}
          className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
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

  if (item.type === "daily") {
    return (
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              {editButton}
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
          {editButton}
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
        {editForm}
      </Card>
    );
  }

  if (item.type === "interview") {
    const stage = (item.data.stage as InterviewStage) ?? "applied";
    const coverage = (item.data.coveragePercent as number) ?? 0;
    const terminal = stage === "accepted" || stage === "rejected";

    return (
      <Card variant="glass" className="p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">
            {company}
            {role ? ` — ${role}` : ""}
          </p>
          {editButton}
        </div>
        {item.due_at && !terminal && (
          <p className="mt-0.5 text-xs text-slate-400">
            {(() => {
              const d = daysUntil(item.due_at);
              return d < 0 ? "Interview date passed" : d === 0 ? "Interview is today" : `Interview in ${d} day${d === 1 ? "" : "s"}`;
            })()}
          </p>
        )}

        {/* Stage stepper */}
        <div className="mt-3 flex flex-wrap gap-1">
          {STAGES.filter((s) => s.value !== "accepted" && s.value !== "rejected").map((s) => {
            const idx = STAGES.findIndex((x) => x.value === s.value);
            const currentIdx = STAGES.findIndex((x) => x.value === stage);
            const reached = currentIdx >= idx || terminal;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onUpdateInterview(item, { stage: s.value })}
                className={`flex-1 rounded-full py-1 text-center text-[11px] font-medium transition-colors ${
                  stage === s.value ? "bg-accent text-surface" : reached ? "bg-accent/20 text-accent" : "bg-white/5 text-slate-400"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {terminal ? (
          <p className={`mt-2 text-xs font-medium ${stage === "accepted" ? "text-accent" : "text-red-400"}`}>
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

  // "other"
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-white">{item.title}</p>
            {editButton}
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
      {editForm}
    </Card>
  );
}
