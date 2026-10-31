"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { CopyIcon, EditIcon, PlusIcon } from "../ui/icons";
import { PortfolioSectionCard } from "./PortfolioSectionCard";
import type { PortfolioSection, PortfolioItem, ItemKind } from "@/lib/portfolio-types";

/**
 * Owns all Portfolio state and mutations in one place (APPROACH.md §9's
 * generic sections+items model) — Read/Edit mode is pure client-side UI
 * state, no backend concept.
 */
export function PortfolioBoard({ initialSections }: { initialSections: PortfolioSection[] }) {
  const [sections, setSections] = useState(initialSections);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied to clipboard");
    } catch {
      showToast("Couldn't copy — select and copy manually");
    }
  }

  function copyEverything() {
    const lines = sections.flatMap((s) => s.items.filter((i) => i.value).map((i) => `${i.label}: ${i.value}`));
    if (lines.length === 0) {
      showToast("Nothing to copy yet");
      return;
    }
    copyToClipboard(lines.join("\n"));
  }

  function patchSection(id: string, patch: Partial<PortfolioSection>) {
    setSections((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function patchItem(id: string, patch: Partial<PortfolioItem>) {
    setSections((ss) => ss.map((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })));
  }

  async function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    const res = await fetch("/api/portfolio/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSectionTitle.trim() }),
    });
    const section = await res.json();
    setSections((ss) => [...ss, { ...section, items: [] }]);
    setNewSectionTitle("");
    setAddingSection(false);
  }

  async function handleRenameSection(section: PortfolioSection, title: string) {
    patchSection(section.id, { title });
    await fetch(`/api/portfolio/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }

  async function handleDeleteSection(section: PortfolioSection) {
    setSections((ss) => ss.filter((s) => s.id !== section.id));
    await fetch(`/api/portfolio/sections/${section.id}`, { method: "DELETE" });
  }

  async function handleAddItem(
    section: PortfolioSection,
    input: { kind: ItemKind; label: string; value: string },
  ) {
    const res = await fetch("/api/portfolio/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: section.id, ...input }),
    });
    if (!res.ok) {
      showToast("Couldn't add that item");
      return;
    }
    const item = await res.json();
    patchSection(section.id, { items: [...section.items, item] });
  }

  async function handleUploadDocument(section: PortfolioSection, input: { label: string; file: File }) {
    const formData = new FormData();
    formData.append("sectionId", section.id);
    formData.append("label", input.label);
    formData.append("file", input.file);
    const res = await fetch("/api/portfolio/items/upload", { method: "POST", body: formData });
    if (!res.ok) {
      showToast("Couldn't upload that document");
      return;
    }
    const item = await res.json();
    patchSection(section.id, { items: [...section.items, item] });
  }

  async function handleTogglePin(item: PortfolioItem) {
    const pinned = !item.pinned;
    patchItem(item.id, { pinned });
    await fetch(`/api/portfolio/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
  }

  async function handleEditItem(item: PortfolioItem, patch: { label?: string; value?: string; note?: string }) {
    patchItem(item.id, patch);
    await fetch(`/api/portfolio/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function handleDeleteItem(item: PortfolioItem) {
    setSections((ss) => ss.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) })));
    await fetch(`/api/portfolio/items/${item.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={copyEverything}>
          <CopyIcon width={15} height={15} />
          Copy everything as text
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={editMode ? "border-accent/40 bg-accent/15 text-accent" : ""}
          onClick={() => setEditMode((v) => !v)}
        >
          <EditIcon width={16} height={16} />
          {editMode ? "Done editing" : "Edit layout"}
        </Button>
      </div>

      {sections.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          Nothing set up yet — add a section (Profiles, Documents, Contact — or anything you want) to get started.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {sections.map((section) => (
            <PortfolioSectionCard
              key={section.id}
              section={section}
              editMode={editMode}
              onCopy={copyToClipboard}
              onRename={handleRenameSection}
              onDeleteSection={handleDeleteSection}
              onAddItem={handleAddItem}
              onUploadDocument={handleUploadDocument}
              onTogglePin={handleTogglePin}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {editMode && (
        <div className="mt-4">
          {addingSection ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/15 p-3">
              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Section name (e.g. Visa Status, References)"
                autoFocus
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={handleAddSection}>
                Add
              </Button>
              <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setAddingSection(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm text-slate-400 transition-colors hover:border-accent/30 hover:text-accent"
            >
              <PlusIcon width={15} height={15} />
              Add a new section
            </button>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-accent/30 bg-surface-card px-4 py-2 text-sm font-medium text-accent shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
