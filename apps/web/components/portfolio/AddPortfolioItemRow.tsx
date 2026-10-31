"use client";

import { useRef, useState } from "react";
import { Button } from "../ui/Button";
import { PlusIcon } from "../ui/icons";
import type { ItemKind } from "@/lib/portfolio-types";

export function AddPortfolioItemRow({
  onAdd,
  onUpload,
}: {
  onAdd: (input: { kind: ItemKind; label: string; value: string }) => Promise<void>;
  onUpload: (input: { label: string; file: File }) => Promise<void>;
}) {
  const [open, setOpen] = useState<ItemKind | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setOpen(null);
    setLabel("");
    setValue("");
  }

  async function submit() {
    if (!label.trim() || !open) return;
    if (open === "document") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;
      setSubmitting(true);
      try {
        await onUpload({ label: label.trim(), file });
        reset();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await onAdd({ kind: open, label: label.trim(), value: value.trim() });
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="flex gap-2 border-t border-dashed border-white/10 px-4 py-3">
        {(["link", "text", "document"] as ItemKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(kind)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-accent"
          >
            <PlusIcon width={15} height={15} />
            {kind === "link" ? "Link" : kind === "text" ? "Text field" : "Document"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-white/10 bg-white/[0.03] px-4 py-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (e.g. GitHub, Resume, Phone)"
        className="w-full rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
        autoFocus
      />
      {open === "document" ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="w-full text-sm text-slate-300"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={open === "link" ? "https://…" : "Value"}
          className="w-full rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="px-3.5 py-1.5 text-sm" onClick={reset}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" className="px-3.5 py-1.5 text-sm" disabled={submitting} onClick={submit}>
          {submitting ? "Adding…" : "Add"}
        </Button>
      </div>
    </div>
  );
}
