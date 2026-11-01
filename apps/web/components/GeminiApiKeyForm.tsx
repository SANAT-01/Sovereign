"use client";

import { useState } from "react";
import { Button } from "./ui/Button";

export function GeminiApiKeyForm({ initialHasKey }: { initialHasKey: boolean }) {
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!apiKey.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/gemini-key", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save the key.");
        return;
      }
      setHasKey(true);
      setEditing(false);
      setApiKey("");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove your Gemini API key? The Assistant won't work until you add a new one.")) return;
    setSubmitting(true);
    try {
      await fetch("/api/profile/gemini-key", { method: "DELETE" });
      setHasKey(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your Gemini API key"
          autoFocus
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="px-4 py-2 text-sm" disabled={submitting} onClick={save}>
            {submitting ? "Saving…" : "Save key"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-4 py-2 text-sm"
            onClick={() => {
              setEditing(false);
              setApiKey("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm font-medium ${hasKey ? "text-accent" : "text-slate-400"}`}>
        {hasKey ? "API key configured" : "Not set"}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="px-4 py-2 text-sm" onClick={() => setEditing(true)}>
          {hasKey ? "Replace key" : "Add key"}
        </Button>
        {hasKey && (
          <Button type="button" variant="ghost" className="px-4 py-2 text-sm text-red-400" disabled={submitting} onClick={remove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
