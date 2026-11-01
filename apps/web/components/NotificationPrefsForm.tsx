"use client";

import { useState } from "react";
import { Button } from "./ui/Button";

interface NotificationPrefs {
  enabled: boolean;
  intervalMinutes: number;
  lastSentAt: string | null;
}

function formatLastSent(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const MIN_HOURS = 6;
const MAX_HOURS = 24;

function clampHours(hours: number): number {
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, hours));
}

export function NotificationPrefsForm({ initialPrefs }: { initialPrefs: NotificationPrefs }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [hours, setHours] = useState(clampHours(Math.round(initialPrefs.intervalMinutes / 60)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<NotificationPrefs>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save.");
        return;
      }
      const { user } = await res.json();
      setPrefs(user.notification_prefs);
      setHours(clampHours(Math.round(user.notification_prefs.intervalMinutes / 60)));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled() {
    await save({ enabled: !prefs.enabled });
  }

  async function saveInterval() {
    await save({ intervalMinutes: hours * 60 });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm font-medium ${prefs.enabled ? "text-accent" : "text-slate-400"}`}>
          {prefs.enabled ? "Reminders on" : "Reminders off"}
        </span>
        <Button type="button" variant="secondary" className="px-4 py-2 text-sm" disabled={submitting} onClick={toggleEnabled}>
          {prefs.enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={MIN_HOURS}
          max={MAX_HOURS}
          step={1}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-white/10 accent-accent"
        />
        <span className="w-16 text-sm text-slate-300">{hours} hrs</span>
        <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" disabled={submitting} onClick={saveInterval}>
          Save
        </Button>
      </div>
      <p className="text-xs text-slate-500">Checks every {hours} hours (range: 6–24 hours).</p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <p className="text-xs text-slate-500">Last sent: {formatLastSent(prefs.lastSentAt)}</p>
    </div>
  );
}
