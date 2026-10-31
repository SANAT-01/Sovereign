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
  const [collapsed, setCollapsed] = useState(false);

  function saveRename() {
    if (!title.trim()) return;
    onRename(section, title.trim());
    setRenaming(false);
  }

  return (
    <div>
      {/* Title sits outside/above the card, not nested inside its border —
          a section label, not another row within the box. */}
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        {renaming ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button type="button" variant="secondary" className="px-3.5 py-1.5 text-sm" onClick={saveRename}>
              Save
            </Button>
            <Button type="button" variant="ghost" className="px-3.5 py-1.5 text-sm" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300"
              title={collapsed ? "Expand" : "Collapse"}
            >
              <ChevronIcon width={14} height={14} className={`transition-transform ${collapsed ? "" : "rotate-90"}`} />
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">{section.title}</p>
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
                  className="rounded-lg p-1.5 text-slate-500 hover:text-accent"
                >
                  <EditIcon width={16} height={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${section.title}" and all its items?`)) onDeleteSection(section);
                  }}
                  title="Delete section"
                  className="rounded-lg p-1.5 text-slate-500 hover:text-red-400"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <Card variant="solid" className="overflow-hidden p-0">
          {section.items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nothing here yet.</p>
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
        </Card>
      )}
    </div>
  );
}
