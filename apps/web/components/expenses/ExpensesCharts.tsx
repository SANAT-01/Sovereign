"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "../ui/Card";
import type { DailyPoint, ExpensesChartsResponse } from "@/lib/expenses-types";

// Same validated palette as the design mockup (design/expenses-charts-mockup.html)
// — teal for income/accent, warm red for expense. Checked with the project's
// dataviz palette validator against this app's dark card surface.
const ACCENT = "#2dd4a0";
const EXPENSE = "#e36b5c";

const tooltipStyle = {
  background: "#16201f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
};
const axisTick = { fill: "#94a3b8", fontSize: 11 };

type RangeKey = "7" | "30" | "90" | "180" | "all";
const RANGE_PRESETS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "3M", days: 90 },
  { key: "180", label: "6M", days: 180 },
  { key: "all", label: "All", days: null },
];

type Granularity = "day" | "week" | "month";

function fmt(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

// Buckets the daily expense series into week/month totals — the Expense
// trend chart's own local toggle, independent of the global range filter.
function bucketExpense(days: DailyPoint[], unit: "week" | "month"): { key: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const d of days) {
    let key: string;
    if (unit === "week") {
      const date = new Date(`${d.date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - date.getUTCDay());
      key = isoDay(date);
    } else {
      key = d.date.slice(0, 7);
    }
    buckets.set(key, (buckets.get(key) ?? 0) + d.expense);
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({ key, value }));
}

export function ExpensesCharts({ initialData }: { initialData: ExpensesChartsResponse }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("day");

  // One real API call per range change — same server-aggregated pattern as
  // the transactions table, not a client-side recompute over everything.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (customFrom && customTo) {
      params.set("from", customFrom);
      params.set("to", customTo);
    } else {
      const preset = RANGE_PRESETS.find((r) => r.key === range);
      if (preset?.days) {
        const to = new Date();
        const from = new Date(to.getTime() - (preset.days - 1) * 86400000);
        params.set("from", isoDay(from));
        params.set("to", isoDay(to));
      }
    }

    fetch(`/api/expenses/charts?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: ExpensesChartsResponse) => setData(json))
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Failed to load expense charts", err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [range, customFrom, customTo]);

  const balanceData = useMemo(
    () => data.days.map((d) => ({ date: d.date, label: formatDateShort(d.date), balance: d.balance })),
    [data.days],
  );
  const dailyExpenseData = useMemo(
    () => data.days.map((d) => ({ date: d.date, label: formatDateShort(d.date), expense: d.expense })),
    [data.days],
  );
  const bucketedExpenseData = useMemo(() => {
    if (granularity === "day") return [];
    const buckets = bucketExpense(data.days, granularity);
    return buckets.map((b) => ({
      key: b.key,
      label: granularity === "month" ? formatMonthShort(b.key) : formatDateShort(b.key),
      value: b.value,
    }));
  }, [data.days, granularity]);
  const monthlyData = useMemo(
    () => data.monthly.map((m) => ({ ...m, label: formatMonthShort(m.month) })),
    [data.monthly],
  );
  const maxMerchant = Math.max(...data.topMerchants.map((m) => m.amount), 1);

  const dayTickInterval = Math.max(0, Math.ceil(dailyExpenseData.length / 8) - 1);

  function selectRange(key: RangeKey) {
    setRange(key);
    setCustomFrom("");
    setCustomTo("");
  }

  const rangeSummary = data.days.length
    ? `${formatDateShort(data.days[0].date)} → ${formatDateShort(data.days[data.days.length - 1].date)} (${data.days.length} days)`
    : "No data in range";

  return (
    <div>
      {/* Global filter bar — filters every chart and stat tile below. */}
      <Card variant="solid" className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => selectRange(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === p.key && !customFrom && !customTo
                  ? "bg-accent text-surface"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/10" />
        <span className="text-xs text-slate-500">Custom:</span>
        <input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="ml-auto text-xs text-slate-500">{loading ? "Loading…" : rangeSummary}</span>
      </Card>

      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="solid" className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total income</p>
          <p className="mt-1 text-xl font-semibold text-accent">{fmt(data.stats.income)}</p>
        </Card>
        <Card variant="solid" className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total expense</p>
          <p className="mt-1 text-xl font-semibold" style={{ color: EXPENSE }}>
            {fmt(data.stats.expense)}
          </p>
        </Card>
        <Card variant="solid" className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net savings</p>
          <p className="mt-1 text-xl font-semibold text-white">{fmt(data.stats.net)}</p>
        </Card>
        <Card variant="solid" className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current balance</p>
          <p className="mt-1 text-xl font-semibold text-white">{fmt(data.stats.balance)}</p>
        </Card>
      </div>

      {/* Balance over time — single series, no legend needed (title names it). */}
      <Card variant="solid" className="mt-4 p-6">
        <p className="text-sm font-medium text-accent">Balance over time</p>
        <p className="mt-1 text-xs text-slate-400">
          Every transaction&rsquo;s running balance — the exact ledger, not a recomputation.
        </p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={dayTickInterval} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="balance" stroke={ACCENT} strokeWidth={2} fill="url(#balanceFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Expense trend — the actual ask: a true daily line, not pre-aggregated. */}
      <Card variant="solid" className="mt-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-accent">Expense trend</p>
            <p className="mt-1 text-xs text-slate-400">
              Per-day spend as its own line — not pre-aggregated like the bars below.
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-white/5 p-1">
            {(["day", "week", "month"] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  granularity === g ? "bg-accent text-surface" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            {granularity === "day" ? (
              <LineChart data={dailyExpenseData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={dayTickInterval} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="expense" stroke={EXPENSE} strokeWidth={1.5} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={bucketedExpenseData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.ceil(bucketedExpenseData.length / 10) - 1)}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill={EXPENSE} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Income vs. expense — the one 2-series chart, legend shown. */}
        <Card variant="solid" className="p-6">
          <p className="text-sm font-medium text-accent">Income vs. expense, by month</p>
          <p className="mt-1 text-xs text-slate-400">Grouped bars — each month, money in beside money out.</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmt(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Bar dataKey="income" name="Income" fill={ACCENT} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill={EXPENSE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top merchants — one hue, magnitude ranking, direct value labels. */}
        <Card variant="solid" className="p-6">
          <p className="text-sm font-medium text-accent">Top merchants by spend</p>
          <p className="mt-1 text-xs text-slate-400">
            Summed debit per counterparty/merchant, highest first, within the selected range.
          </p>
          <div className="mt-4">
            {data.topMerchants.length === 0 ? (
              <p className="text-sm text-slate-500">No debit transactions in range.</p>
            ) : (
              data.topMerchants.map((m) => (
                <div key={m.name} className="mb-2.5 flex items-center gap-2 last:mb-0">
                  <span className="w-28 flex-shrink-0 truncate text-right text-xs text-slate-400" title={m.name}>
                    {m.name}
                  </span>
                  <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="flex h-full items-center rounded-full"
                      style={{ width: `${(m.amount / maxMerchant) * 100}%`, background: ACCENT }}
                    >
                      <span className="pl-2 text-xs text-surface">{fmt(m.amount)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
