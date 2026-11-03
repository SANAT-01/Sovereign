"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CopyIcon, EditIcon, PlusIcon, PinIcon, ChevronIcon } from "../ui/icons";
import { PortfolioSectionCard } from "./PortfolioSectionCard";
import { PortfolioItemRow } from "./PortfolioItemRow";
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
  // Every section starts collapsed — pinned items (below) stay one click
  // away regardless, so the page opens as a scannable list of sections.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = sections.length > 0 && sections.every((s) => expanded.has(s.id));
  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(sections.map((s) => s.id)));
  }

  const pinnedItems = sections.flatMap((s) => s.items.filter((i) => i.pinned));
  const itemCount = sections.reduce((sum, s) => sum + s.items.length, 0);

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
    // A brand-new section is opened straight away so items can be added to it.
    setExpanded((prev) => new Set(prev).add(section.id));
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
      {/* Toolbar as one floating glass pill rather than loose buttons. */}
      <div className="liquid-glass flex flex-wrap items-center gap-1.5 rounded-3xl p-1.5 sm:rounded-full">
        <Button type="button" className="px-4 py-2" onClick={copyEverything}>
          <CopyIcon width={15} height={15} />
          Copy everything
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={editMode}
          className={`px-4 py-2 ${editMode ? "bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
          onClick={() => setEditMode((v) => !v)}
        >
          <EditIcon width={16} height={16} />
          {editMode ? "Done editing" : "Edit layout"}
        </Button>
        {sections.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden px-2 text-xs text-slate-400 sm:inline">
              {sections.length} {sections.length === 1 ? "section" : "sections"} · {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"}
            </span>
            <Button type="button" variant="ghost" className="px-3.5 py-2" onClick={toggleAll}>
              <ChevronIcon
                width={14}
                height={14}
                className={`transition-transform duration-200 ${allExpanded ? "-rotate-90" : "rotate-90"}`}
              />
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          </div>
        )}
      </div>

      {pinnedItems.length > 0 && (
        <Card className="mt-4 overflow-hidden border-amber-300/25 bg-amber-300/[0.035] p-1.5">
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <PinIcon width={13} height={13} fill="currentColor" className="text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">Pinned</span>
          </div>
          {pinnedItems.map((item) => (
            <PortfolioItemRow
              key={item.id}
              item={item}
              editMode={false}
              onCopy={copyToClipboard}
              onTogglePin={handleTogglePin}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </Card>
      )}

      {sections.length === 0 ? (
        <Card className="mt-4 px-6 py-8 text-center">
          <p className="text-sm text-slate-300">Nothing set up yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Switch to Edit layout and add a section — Profiles, Documents, Contact, or anything you want.
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {sections.map((section) => (
            <PortfolioSectionCard
              key={section.id}
              section={section}
              expanded={expanded.has(section.id)}
              onToggle={() => toggleSection(section.id)}
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
        <div className="mt-3">
          {addingSection ? (
            <div className="liquid-glass flex items-center gap-2 rounded-3xl p-2 sm:rounded-full">
              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                placeholder="Section name (e.g. Visa Status, References)"
                autoFocus
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button type="button" className="px-4 py-2" onClick={handleAddSection}>
                Add
              </Button>
              <Button type="button" variant="ghost" className="px-3.5 py-2" onClick={() => setAddingSection(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-3.5 text-sm text-slate-400 backdrop-blur-xl transition-colors hover:border-accent/40 hover:bg-accent/[0.05] hover:text-accent"
            >
              <PlusIcon width={15} height={15} />
              Add a new section
            </button>
          )}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="liquid-glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-accent"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
