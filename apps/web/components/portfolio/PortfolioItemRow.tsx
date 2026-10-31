"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { CopyIcon, OpenIcon, DownloadIcon, PinIcon, EditIcon, TrashIcon, FileIcon, FieldIcon } from "../ui/icons";
import type { PortfolioItem } from "@/lib/portfolio-types";

const KIND_ICON = { link: OpenIcon, document: FileIcon, text: FieldIcon };

export function PortfolioItemRow({
  item,
  editMode,
  onCopy,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  item: PortfolioItem;
  editMode: boolean;
  onCopy: (value: string) => void;
  onTogglePin: (item: PortfolioItem) => void;
  onEdit: (item: PortfolioItem, patch: { label?: string; value?: string; note?: string }) => void;
  onDelete: (item: PortfolioItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [value, setValue] = useState(item.value ?? "");
  const Icon = KIND_ICON[item.kind];

  function startEdit() {
    setLabel(item.label);
    setValue(item.value ?? "");
    setEditing(true);
  }

  function save() {
    if (!label.trim()) return;
    onEdit(item, { label: label.trim(), ...(item.kind !== "document" ? { value: value.trim() } : {}) });
    setEditing(false);
  }

  return (
    <div className="border-b border-white/[0.06] px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-accent">
          <Icon width={20} height={20} />
        </div>
        {/* Label/value get the full row to themselves, never squeezed by
            the action buttons — those wrap onto their own line below. */}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-white">{item.label}</p>
          <p className="break-words text-sm text-slate-400">{item.value || "—"}</p>
          {item.note && <p className="break-words text-xs text-slate-500">{item.note}</p>}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTogglePin(item)}
            title={item.pinned ? "Unpin" : "Pin"}
            className={`flex items-center justify-center rounded-full border p-2 transition-colors ${
              item.pinned
                ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
            }`}
          >
            <PinIcon width={16} height={16} fill={item.pinned ? "currentColor" : "none"} />
          </button>
          {editMode && (
            <>
              <button
                type="button"
                onClick={startEdit}
                title="Edit"
                className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:border-accent/30 hover:text-accent"
              >
                <EditIcon width={16} height={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${item.label}"?`)) onDelete(item);
                }}
                title="Delete"
                className="flex items-center justify-center rounded-full border border-red-400/20 bg-red-400/5 p-2 text-red-400/80 transition-colors hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-400"
              >
                <TrashIcon width={16} height={16} />
              </button>
            </>
          )}
          {item.value && (
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-sm"
              onClick={() => onCopy(item.value!)}
            >
              <CopyIcon width={16} height={16} />
              Copy
            </Button>
          )}
          {item.kind === "link" && item.value && (
            <a href={item.value} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="accent" className="px-3 py-2 text-sm">
                <OpenIcon width={16} height={16} />
                Open
              </Button>
            </a>
          )}
          {item.kind === "document" && item.value && (
            <a href={item.value} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="accent" className="px-3 py-2 text-sm">
                <DownloadIcon width={16} height={16} />
                Download
              </Button>
            </a>
          )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-xl bg-white/5 p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="w-full rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {item.kind !== "document" && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={item.kind === "link" ? "https://…" : "Value"}
              className="w-full rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="px-3.5 py-1.5 text-sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" className="px-3.5 py-1.5 text-sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
