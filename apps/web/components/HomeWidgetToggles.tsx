"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVAILABLE_MODULES = [
  { key: "progress", label: "Progress Tracker", ready: true },
  { key: "expenses", label: "Expense Tracker", ready: true },
  { key: "notes", label: "Notes", ready: true },
  { key: "portfolio", label: "Portfolio", ready: true },
];

/**
 * Lets the user pick which module summaries show on the home screen
 * (APPROACH.md §10 — home is a curated summary, not a fixed dashboard,
 * since there can be many modules over time). Only modules with a real
 * summary (`ready: true`) are toggleable; others show as "coming soon" so
 * the control doesn't offer a toggle that would just show fabricated data.
 */
export function HomeWidgetToggles({ initialWidgets }: { initialWidgets: string[] }) {
  const router = useRouter();
  const [widgets, setWidgets] = useState(new Set(initialWidgets));
  const [open, setOpen] = useState(false);

  async function toggle(key: string) {
    const next = new Set(widgets);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setWidgets(next);

    await fetch("/api/profile/home-widgets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgets: Array.from(next) }),
    });
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-slate-400 hover:text-white"
      >
        Customize home
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 w-56 rounded-xl border border-white/10 bg-surface-card/95 p-3 shadow-lg backdrop-blur-xl">
          <p className="mb-2 text-xs font-medium text-slate-300">Show on home</p>
          <ul className="space-y-1.5">
            {AVAILABLE_MODULES.map((mod) => (
              <li key={mod.key} className="flex items-center justify-between gap-2">
                <label
                  className={`flex items-center gap-2 text-xs ${mod.ready ? "text-slate-200" : "text-slate-500"}`}
                >
                  <input
                    type="checkbox"
                    checked={widgets.has(mod.key)}
                    disabled={!mod.ready}
                    onChange={() => toggle(mod.key)}
                    className="accent-accent"
                  />
                  {mod.label}
                </label>
                {!mod.ready && <span className="text-[10px] text-slate-600">soon</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
