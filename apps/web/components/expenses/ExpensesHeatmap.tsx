"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/Card";
import type { DailyPoint, Expense, ExpensesChartsResponse, ExpensesListResponse } from "@/lib/expenses-types";

// Sequential ramp, one hue (the app's "expense" warm red), light→dark by
// magnitude — index 0 is "no spend" (neutral, not part of the ramp).
const RAMP = ["rgba(255,255,255,0.05)", "#3a2420", "#6b352c", "#a94638", "#e36b5c"];
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;

type SpanKey = "365" | "90";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmt(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function formatAmount(value: string | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Builds one continuous row per calendar day in the span, filling in 0 for
// days with no transactions — the API only returns rows for days that
// actually had activity (GROUP BY date), so gaps mean no spend, not "no data".
function buildContinuousDays(days: DailyPoint[], spanDays: number): { date: Date; expense: number }[] {
  const byDate = new Map(days.map((d) => [d.date, d.expense]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { date: Date; expense: number }[] = [];
  for (let i = spanDays - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000);
    out.push({ date, expense: byDate.get(isoDay(date)) ?? 0 });
  }
  return out;
}

export function ExpensesHeatmap() {
  const [span, setSpan] = useState<SpanKey>("365");
  const [days, setDays] = useState<{ date: Date; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ rows: Expense[]; total: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const spanDays = span === "365" ? 365 : 90;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - (spanDays - 1) * 86400000);
    const params = new URLSearchParams({ from: isoDay(from), to: isoDay(to) });

    fetch(`/api/expenses/charts?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: ExpensesChartsResponse) => setDays(buildContinuousDays(json.days, spanDays)))
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Failed to load heatmap data", err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [spanDays]);

  const thresholds = useMemo(() => {
    const nonZero = days.map((d) => d.expense).filter((v) => v > 0).sort((a, b) => a - b);
    const quantile = (p: number) => (nonZero.length ? nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] : 0);
    return [quantile(0.25), quantile(0.5), quantile(0.75)];
  }, [days]);

  function levelFor(expense: number): number {
    if (expense <= 0) return 0;
    if (expense <= thresholds[0]) return 1;
    if (expense <= thresholds[1]) return 2;
    if (expense <= thresholds[2]) return 3;
    return 4;
  }

  // Pad to start on a Sunday so weeks line up into clean columns, same as
  // the mockup — index 0 of `padded` is always a Sunday (or null filler).
  const { weeks, monthLabels } = useMemo(() => {
    if (!days.length) return { weeks: [] as ({ date: Date; expense: number } | null)[][], monthLabels: [] as { label: string; x: number }[] };
    const firstDow = days[0].date.getDay();
    const padded: ({ date: Date; expense: number } | null)[] = [...Array(firstDow).fill(null), ...days];
    const weekCount = Math.ceil(padded.length / 7);
    const cols: ({ date: Date; expense: number } | null)[][] = [];
    const labels: { label: string; x: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weekCount; w++) {
      const col = padded.slice(w * 7, w * 7 + 7);
      cols.push(col);
      for (const day of col) {
        if (day && day.date.getDate() <= 7 && day.date.getMonth() !== lastMonth) {
          lastMonth = day.date.getMonth();
          labels.push({ label: day.date.toLocaleDateString(undefined, { month: "short" }), x: w * STEP });
        }
      }
    }
    return { weeks: cols, monthLabels: labels };
  }, [days]);

  async function selectDay(date: Date) {
    const iso = isoDay(date);
    setSelectedIso(iso);
    setDetailLoading(true);
    setDetail(null);
    try {
      const params = new URLSearchParams({ from: iso, to: iso, pageSize: "100", sort: "date", dir: "asc" });
      const res = await fetch(`/api/expenses?${params}`);
      if (res.ok) {
        const json: ExpensesListResponse = await res.json();
        setDetail({ rows: json.rows, total: json.total });
      }
    } catch (err) {
      console.error("Failed to load day's transactions", err);
    } finally {
      setDetailLoading(false);
    }
  }

  const selectedTotal = detail?.rows.reduce((sum, r) => sum + (r.debit ? Number(r.debit) : 0), 0) ?? 0;

  return (
    <Card variant="solid" className="mt-4 p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-accent">Spend heatmap</p>
          <p className="mt-1 text-xs text-slate-400">Darker = more spent that day. Click any square for the full list.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setSpan("365")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              span === "365" ? "bg-accent text-surface" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 12 months
          </button>
          <button
            type="button"
            onClick={() => setSpan("90")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              span === "90" ? "bg-accent text-surface" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 3 months
          </button>
        </div>
      </div>

      {/* Tooltip is positioned relative to this wrapper, which has no
          `overflow` of its own — the inner div below scrolls horizontally,
          but the tooltip renders as its sibling so the scroll clipping
          never cuts it off. */}
      <div ref={gridRef} className="relative mt-4">
        <div className="overflow-x-auto pb-1">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <div className="inline-flex gap-[10px]">
              <div
                className="grid gap-[3px] pt-[18px]"
                style={{ gridTemplateRows: `repeat(7, ${CELL}px)` }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <div key={d} className="text-[9px] leading-3 text-slate-500" style={{ height: CELL }}>
                    {i % 2 === 1 ? d.slice(0, 3) : ""}
                  </div>
                ))}
              </div>
              <div>
                <div className="relative" style={{ height: 14, width: weeks.length * STEP }}>
                  {monthLabels.map((m, i) => (
                    <div key={i} className="absolute top-0 text-[9px] text-slate-500" style={{ left: m.x }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-flow-col gap-[3px]">
                  {weeks.map((col, w) => (
                    <div key={w} className="grid gap-[3px]" style={{ gridTemplateRows: `repeat(7, ${CELL}px)` }}>
                      {col.map((day, d) =>
                        day ? (
                          <button
                            key={d}
                            type="button"
                            onClick={() => selectDay(day.date)}
                            onMouseEnter={(e) => {
                              const cellRect = e.currentTarget.getBoundingClientRect();
                              const containerRect = gridRef.current!.getBoundingClientRect();
                              setTooltip({
                                x: cellRect.left - containerRect.left + cellRect.width / 2,
                                y: cellRect.top - containerRect.top,
                                text: `${day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — ${
                                  day.expense > 0 ? fmt(day.expense) : "No spend"
                                }`,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`rounded-[3px] transition-[outline] ${
                              isoDay(day.date) === selectedIso ? "outline outline-[1.5px] outline-offset-1 outline-white" : ""
                            }`}
                            style={{ width: CELL, height: CELL, background: RAMP[levelFor(day.expense)] }}
                          />
                        ) : (
                          <div key={d} style={{ width: CELL, height: CELL }} />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {tooltip && (
          <div
            className="absolute z-20 -translate-x-1/2 -translate-y-[115%] whitespace-nowrap rounded-lg border border-white/10 bg-[#0d3b36] px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
        Less
        {RAMP.map((color, i) => (
          <span key={i} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: color }} />
        ))}
        More
      </div>

      {selectedIso && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              Transactions —{" "}
              {new Date(`${selectedIso}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="flex items-center gap-3">
              {selectedTotal > 0 && (
                <span className="text-xs font-semibold" style={{ color: "#e36b5c" }}>
                  Total spent: {fmt(selectedTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedIso(null);
                  setDetail(null);
                }}
                className="text-xs text-slate-500 underline hover:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>

          {detailLoading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : !detail || detail.rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No transactions on this day.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Details</th>
                  <th className="py-2 pr-3 font-medium">Counterparty</th>
                  <th className="py-2 pr-3 text-right font-medium">Debit</th>
                  <th className="py-2 pr-3 text-right font-medium">Credit</th>
                  <th className="py-2 pr-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-b-0">
                    <td className="max-w-[260px] truncate py-2 pr-3 text-slate-200" title={e.details}>
                      {e.details || "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {e.counterparty_name || "—"}
                      {e.merchant_name && e.merchant_name !== e.counterparty_name && (
                        <span className="ml-1 text-xs text-slate-500">({e.merchant_name})</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right text-red-300">
                      {e.debit ? formatAmount(e.debit) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right text-emerald-300">
                      {e.credit ? formatAmount(e.credit) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right text-white">{formatAmount(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}
