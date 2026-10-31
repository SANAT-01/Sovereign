"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon, TrashIcon } from "../ui/icons";
import type { NoteListItem } from "@/lib/notes-types";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: {
  notes: NoteListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(query.toLowerCase()) ||
          n.snippet.toLowerCase().includes(query.toLowerCase()),
      )
    : notes;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4 sm:px-5">
        <h1 className="mb-3 text-lg font-semibold text-white">Notes</h1>
        <div className="relative">
          <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mx-4 mt-3 flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-surface transition-transform hover:-translate-y-0.5 sm:mx-5"
      >
        <PlusIcon width={15} height={15} />
        New note
      </button>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3 sm:px-3">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">{notes.length === 0 ? "No notes yet." : "No matches."}</p>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={`group mb-1 cursor-pointer rounded-2xl px-3 py-2.5 transition-colors ${
                selectedId === note.id ? "bg-accent/12" : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`truncate text-sm font-semibold ${selectedId === note.id ? "text-accent" : "text-white"}`}>
                  {note.title || "Untitled note"}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${note.title || "Untitled note"}"?`)) onDelete(note.id);
                  }}
                  className="shrink-0 rounded-lg p-1 text-slate-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Delete"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{note.snippet || "Nothing written yet."}</p>
              <p className="mt-1 text-[11px] text-slate-600">Edited {relativeTime(note.updatedAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
