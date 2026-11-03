"use client";

import { useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { CopyIcon, OpenIcon, DownloadIcon, PinIcon, EditIcon, TrashIcon, FileIcon, FieldIcon } from "../ui/icons";
import type { PortfolioItem } from "@/lib/portfolio-types";

const KIND_ICON = { link: OpenIcon, document: FileIcon, text: FieldIcon };

function IconButton({
  title,
  onClick,
  className = "",
  children,
}: {
  title: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

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

  // Documents are stored as a full file URL — showing it raw is noise, so
  // only links/text fields display their value inline.
  const displayValue = item.kind === "document" ? "Document" : item.value || "—";

  return (
    <div className="rounded-2xl px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.05]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <div className="liquid-bubble flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-accent">
            <Icon width={17} height={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-white">{item.label}</p>
              {item.pinned && <PinIcon width={12} height={12} fill="currentColor" className="shrink-0 text-amber-400" />}
            </div>
            <p className="truncate text-xs text-slate-400" title={item.kind === "document" ? undefined : item.value ?? undefined}>
              {displayValue}
            </p>
            {item.note && <p className="truncate text-xs text-slate-500">{item.note}</p>}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          {item.value && (
            <IconButton title="Copy" onClick={() => onCopy(item.value!)}>
              <CopyIcon width={16} height={16} />
            </IconButton>
          )}
          {item.kind === "link" && item.value && (
            <a
              href={item.value}
              target="_blank"
              rel="noopener noreferrer"
              title="Open"
              aria-label="Open"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <OpenIcon width={16} height={16} />
            </a>
          )}
          {item.kind === "document" && item.value && (
            <a
              href={item.value}
              target="_blank"
              rel="noopener noreferrer"
              title="Download"
              aria-label="Download"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <DownloadIcon width={16} height={16} />
            </a>
          )}
          <IconButton
            title={item.pinned ? "Unpin" : "Pin to top"}
            onClick={() => onTogglePin(item)}
            className={item.pinned ? "text-amber-400 hover:text-amber-300" : ""}
          >
            <PinIcon width={16} height={16} fill={item.pinned ? "currentColor" : "none"} />
          </IconButton>
          {editMode && (
            <>
              <IconButton title="Edit" onClick={startEdit} className="hover:text-accent">
                <EditIcon width={16} height={16} />
              </IconButton>
              <IconButton
                title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete "${item.label}"?`)) onDelete(item);
                }}
                className="hover:bg-red-400/10 hover:text-red-400"
              >
                <TrashIcon width={16} height={16} />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {item.kind !== "document" && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={item.kind === "link" ? "https://…" : "Value"}
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
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
