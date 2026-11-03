"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../ui/Card";
import type { MerchantTrendResponse } from "@/lib/expenses-types";

// Same fixed-order categorical palette as Progress Tracker's category
// breakdown chart (validated against this app's dark card surface) — once
// 2+ merchants are selected this is an identity encoding, not a magnitude
// one, so it gets a categorical palette instead of the single expense red.
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const MAX_MERCHANTS = 5;
const EXPENSE = "#e36b5c";
const ACCENT = "#2dd4a0";

type TransactionType = "debit" | "credit";

const tooltipStyle = {
  background: "#16201f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
};
const axisTick = { fill: "#94a3b8", fontSize: 11 };

function fmt(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MerchantPicker({
  merchants,
  selected,
  onToggle,
  noun,
}: {
  merchants: string[];
  selected: string[];
  onToggle: (name: string) => void;
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen((o) => !o);
  }

  const filtered = merchants.filter((m) => m.toLowerCase().includes(query.trim().toLowerCase()));
  const atLimit = selected.length >= MAX_MERCHANTS;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="min-w-[220px] rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {selected.length === 0 ? `Select ${noun}s…` : `${selected.length} ${noun}${selected.length === 1 ? "" : "s"} selected`}
      </button>

      {/* Rendered into document.body — Card uses backdrop-blur, which creates
          a new stacking context, so an absolutely-positioned child here would
          get trapped below any later sibling Card no matter its z-index. */}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="liquid-glass fixed z-50 w-64 rounded-2xl bg-surface-glass/90 p-2"
            style={{ top: coords.top, left: coords.left }}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun}s…`}
              className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {atLimit && <p className="mt-1.5 px-1 text-[11px] text-amber-300">Up to {MAX_MERCHANTS} {noun}s at a time.</p>}
            <div className="mt-1.5 max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-2 text-xs text-slate-500">No match.</p>
              ) : (
                filtered.map((m) => {
                  const isSelected = selected.includes(m);
                  const disabled = !isSelected && atLimit;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggle(m)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        disabled ? "cursor-not-allowed text-slate-600" : "text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                          isSelected ? "border-accent bg-accent" : "border-white/20"
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-sm bg-surface" />}
                      </span>
                      <span className="truncate">{m}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function ExpensesMerchantTrend({ type = "debit" }: { type?: TransactionType }) {
  const [merchants, setMerchants] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<MerchantTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isCredit = type === "credit";
  const seriesFallback = isCredit ? ACCENT : EXPENSE;
  const noun = isCredit ? "source" : "merchant";

  // Re-fetch the picker's options and reset any selection made under the
  // other type — a merchant picked in "debit" mode may have zero credits.
  useEffect(() => {
    setSelected([]);
    fetch(`/api/expenses/merchants?type=${type}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: string[]) => setMerchants(json))
      .catch((err) => console.error("Failed to load merchants", err));
  }, [type]);

  useEffect(() => {
    if (selected.length === 0) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ merchants: selected.join(","), type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/expenses/merchant-trend?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: MerchantTrendResponse) => setData(json))
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Failed to load merchant trend", err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [selected, from, to, type]);

  function toggleMerchant(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name].slice(0, MAX_MERCHANTS)));
  }

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    selected.forEach((m, i) => map.set(m, SERIES_COLORS[i % SERIES_COLORS.length]));
    return map;
  }, [selected]);

  const chartData = useMemo(
    () =>
      (data?.days ?? []).map((d) => ({
        date: d.date,
        label: formatDateShort(d.date),
        ...d.amounts,
      })),
    [data],
  );

  const combinedTotal = useMemo(
    () => (data ? Object.values(data.totals).reduce((sum, v) => sum + v, 0) : 0),
    [data],
  );

  return (
    <Card variant="solid" className="mt-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-accent">{isCredit ? "Income by source" : "Spend by merchant"}</p>
          <p className="mt-1 text-xs text-slate-400">
            Search and select up to {MAX_MERCHANTS} {noun}s to compare {isCredit ? "income" : "spend"} over time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MerchantPicker merchants={merchants} selected={selected} onToggle={toggleMerchant} noun={noun} />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Selected-merchant chips double as a persistent, always-visible legend. */}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {selected.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMerchant(m)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10"
              title="Remove"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorFor.get(m) }} />
              {m}
              {data?.totals[m] !== undefined && <span className="text-slate-500">{fmt(data.totals[m])}</span>}
              <span className="text-slate-500">×</span>
            </button>
          ))}
          {data && selected.length > 1 && (
            <span className="ml-1 text-xs text-slate-400">
              Combined total: <span className="font-semibold" style={{ color: seriesFallback }}>{fmt(combinedTotal)}</span>
            </span>
          )}
        </div>
      )}

      {selected.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Select one or more {noun}s above to see the trend.</p>
      ) : loading ? (
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-white/5" />
      ) : !chartData.length ? (
        <p className="mt-6 text-sm text-slate-500">
          No {type} transactions for the selected {noun}(s) in this range.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              {selected.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />}
              {selected.map((m) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  name={m}
                  stroke={colorFor.get(m)}
                  strokeWidth={2}
                  dot={selected.length === 1 ? { r: 3, fill: colorFor.get(m) } : false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
