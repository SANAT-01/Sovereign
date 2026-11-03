"use client";

import { useRef, useState } from "react";
import { NotesList } from "./NotesList";
import { NotesEditor } from "./NotesEditor";
import type { NoteListItem, Note } from "@/lib/notes-types";

type SaveStatus = "idle" | "saving" | "saved";

function snippetFromHtml(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/**
 * Owns all Notes state and mutations (APPROACH.md §18) — autosave debounce
 * and the manual Save button share one PATCH path; mobile collapses the
 * list+editor two-pane layout to one pane at a time (Sidebar.tsx's `lg`
 * breakpoint convention).
 */
export function NotesBoard({ initialNotes }: { initialNotes: NoteListItem[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<{ title?: string; content?: string }>({});

  async function flushSave(noteId: string) {
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: Note = await res.json();
      setSaveStatus("saved");
      setNotes((ns) =>
        ns.map((n) =>
          n.id === noteId ? { ...n, title: updated.title, snippet: snippetFromHtml(updated.content), updatedAt: updated.updated_at } : n,
        ),
      );
    }
  }

  function scheduleSave(noteId: string, patch: { title?: string; content?: string }) {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setSaveStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushSave(noteId), 3000);
  }

  async function handleSelectNote(id: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      if (selectedNote) flushSave(selectedNote.id);
    }
    setMobileView("editor");
    const res = await fetch(`/api/notes/${id}`);
    if (!res.ok) return;
    const note: Note = await res.json();
    setSelectedNote(note);
    setSaveStatus("idle");
  }

  async function handleNewNote() {
    const res = await fetch("/api/notes", { method: "POST" });
    if (!res.ok) return;
    const note: Note = await res.json();
    setNotes((ns) => [{ id: note.id, title: "", snippet: "", updatedAt: note.updated_at }, ...ns]);
    setSelectedNote(note);
    setSaveStatus("idle");
    setMobileView("editor");
  }

  function handleChangeTitle(title: string) {
    if (!selectedNote) return;
    setSelectedNote({ ...selectedNote, title });
    setNotes((ns) => ns.map((n) => (n.id === selectedNote.id ? { ...n, title } : n)));
    scheduleSave(selectedNote.id, { title });
  }

  function handleChangeContent(content: string) {
    if (!selectedNote) return;
    setSelectedNote({ ...selectedNote, content });
    setNotes((ns) => ns.map((n) => (n.id === selectedNote.id ? { ...n, snippet: snippetFromHtml(content) } : n)));
    scheduleSave(selectedNote.id, { content });
  }

  function handleManualSave() {
    if (!selectedNote) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    flushSave(selectedNote.id);
  }

  async function handleDeleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((ns) => ns.filter((n) => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setMobileView("list");
    }
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div
        className={`liquid-glass liquid-glass-tint min-h-0 flex-col rounded-3xl lg:flex lg:w-80 lg:shrink-0 ${
          mobileView === "editor" ? "hidden" : "flex w-full"
        }`}
      >
        <NotesList
          notes={notes}
          selectedId={selectedNote?.id ?? null}
          onSelect={handleSelectNote}
          onNew={handleNewNote}
          onDelete={handleDeleteNote}
        />
      </div>

      <div
        className={`liquid-glass liquid-glass-tint min-h-0 flex-1 flex-col rounded-3xl lg:flex ${
          mobileView === "list" ? "hidden" : "flex w-full"
        }`}
      >
        {selectedNote ? (
          <NotesEditor
            note={selectedNote}
            saveStatus={saveStatus}
            onChangeTitle={handleChangeTitle}
            onChangeContent={handleChangeContent}
            onManualSave={handleManualSave}
            onDelete={() => handleDeleteNote(selectedNote.id)}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
            Select a note, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
