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
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-2xl border border-dashed border-white/10 p-1.5">
        {(["link", "text", "document"] as ItemKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(kind)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-accent/10 hover:text-accent"
          >
            <PlusIcon width={15} height={15} />
            {kind === "link" ? "Link" : kind === "text" ? "Text field" : "Document"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (e.g. GitHub, Resume, Phone)"
        className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
        autoFocus
      />
      {open === "document" ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="w-full text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-accent/15 file:px-3.5 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/25"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={open === "link" ? "https://…" : "Value"}
          className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
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
