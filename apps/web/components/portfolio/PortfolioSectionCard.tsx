"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { EditIcon, TrashIcon, ChevronIcon } from "../ui/icons";
import { PortfolioItemRow } from "./PortfolioItemRow";
import { AddPortfolioItemRow } from "./AddPortfolioItemRow";
import type { PortfolioSection, PortfolioItem, ItemKind } from "@/lib/portfolio-types";

export function PortfolioSectionCard({
  section,
  expanded,
  onToggle,
  editMode,
  onCopy,
  onRename,
  onDeleteSection,
  onAddItem,
  onUploadDocument,
  onTogglePin,
  onEditItem,
  onDeleteItem,
}: {
  section: PortfolioSection;
  expanded: boolean;
  onToggle: () => void;
  editMode: boolean;
  onCopy: (value: string) => void;
  onRename: (section: PortfolioSection, title: string) => void;
  onDeleteSection: (section: PortfolioSection) => void;
  onAddItem: (section: PortfolioSection, input: { kind: ItemKind; label: string; value: string }) => Promise<void>;
  onUploadDocument: (section: PortfolioSection, input: { label: string; file: File }) => Promise<void>;
  onTogglePin: (item: PortfolioItem) => void;
  onEditItem: (item: PortfolioItem, patch: { label?: string; value?: string; note?: string }) => void;
  onDeleteItem: (item: PortfolioItem) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(section.title);

  function saveRename() {
    if (!title.trim()) return;
    onRename(section, title.trim());
    setRenaming(false);
  }

  const count = section.items.length;

  return (
    <Card className="overflow-hidden p-0">
      {renaming ? (
        <div className="flex items-center gap-2 px-3 py-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            autoFocus
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button type="button" variant="secondary" className="px-3.5 py-1.5 text-sm" onClick={saveRename}>
            Save
          </Button>
          <Button type="button" variant="ghost" className="px-3.5 py-1.5 text-sm" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 pr-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-3xl px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="liquid-bubble flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold uppercase text-accent">
              {section.title.trim().charAt(0) || "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{section.title}</span>
              <span className="block text-xs text-slate-400">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </span>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 transition-all duration-200 group-hover:bg-white/10 group-hover:text-white ${
                expanded ? "rotate-90" : ""
              }`}
            >
              <ChevronIcon width={14} height={14} />
            </span>
          </button>
          {editMode && (
            <>
              <button
                type="button"
                onClick={() => {
                  setTitle(section.title);
                  setRenaming(true);
                }}
                title="Rename section"
                aria-label="Rename section"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-accent"
              >
                <EditIcon width={15} height={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${section.title}" and all its items?`)) onDeleteSection(section);
                }}
                title="Delete section"
                aria-label="Delete section"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-400"
              >
                <TrashIcon width={15} height={15} />
              </button>
            </>
          )}
        </div>
      )}

      {/* grid-rows 0fr→1fr animates height without measuring content. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {/* Recessed inner well — a darker pane set into the lighter outer
              glass, so the items read as a layer beneath the header. */}
          <div className="mx-1.5 mb-1.5 rounded-[1.125rem] border border-white/[0.06] bg-black/20 p-1.5 shadow-[inset_0_2px_8px_rgb(0_0_0/0.25)]">
            {count === 0 ? (
              <p className="px-3 py-2.5 text-sm text-slate-500">
                Nothing here yet{editMode ? "" : " — switch to Edit layout to add items"}.
              </p>
            ) : (
              section.items.map((item) => (
                <PortfolioItemRow
                  key={item.id}
                  item={item}
                  editMode={editMode}
                  onCopy={onCopy}
                  onTogglePin={onTogglePin}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                />
              ))
            )}

            {editMode && (
              <AddPortfolioItemRow
                onAdd={(input) => onAddItem(section, input)}
                onUpload={(input) => onUploadDocument(section, input)}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
