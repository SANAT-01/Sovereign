"use client";

import { useState, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "../ui/Card";
import { ClientOnly } from "../ui/ClientOnly";
import { ChartSkeleton } from "../ui/charts/ChartSkeleton";
import {
  CHART_METRICS,
  CHART_METRIC_KINDS,
  DEFAULT_CHART_PREFS,
  type ChartMetric,
  type ChartKind,
  type ChartPrefs,
  type ProgressChartData,
} from "@/lib/progress-types";

// Validated against this app's actual card surface (#16201f) via the
// dataviz skill's palette validator — exact documented slot order
// (blue, orange, aqua, yellow, magenta) preserved, since the ordering
// itself (not just the hues) is the colorblind-safety mechanism. Used only
// for categoryBreakdown's identity-by-category encoding; the other three
// charts are single-series and use the app's own accent teal throughout.
const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const ACCENT = "#2dd4a0";
const CHART_SURFACE = "#16201f";

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  referral_asked: "Referral",
  interview: "Interview",
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

const FIXED_CATEGORY_LABELS: Record<string, string> = {
  daily: "Daily Habits",
  study_plan: "Study Plans",
  interview: "Interviews",
  other: "Other",
};
function categoryLabel(type: string): string {
  return FIXED_CATEGORY_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

const tooltipStyle = {
  background: CHART_SURFACE,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
};
const axisTick = { fill: "#94a3b8", fontSize: 11 };

const METRIC_TITLES: Record<ChartMetric, string> = {
  categoryBreakdown: "Items by Category",
  interviewFunnel: "Interview Pipeline",
  dailyStreakHistory: "Daily Habits — Last 30 Days",
  studyPlanCoverage: "Study Plan Coverage",
};

function ChartTypeSwitcher({
  metric,
  current,
  onChange,
}: {
  metric: ChartMetric;
  current: ChartKind;
  onChange: (kind: ChartKind) => void;
}) {
  return (
    <div className="flex gap-1">
      {CHART_METRIC_KINDS[metric].map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onChange(kind)}
          className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition-colors ${
            current === kind ? "bg-accent/20 text-accent" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {kind}
        </button>
      ))}
    </div>
  );
}

function CategoryBreakdownChart({ data, kind }: { data: ProgressChartData["categoryBreakdown"]; kind: ChartKind }) {
  if (data.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">Nothing tracked yet.</p>;
  }

  // Cap at the first 4 (by count desc) + fold the rest into "Other
  // (combined)" — a 9th+ series is never a generated hue (dataviz skill).
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, 4);
  const restCount = sorted.slice(4).reduce((sum, c) => sum + c.count, 0);
  const chartData = [
    ...top.map((c) => ({ name: categoryLabel(c.category), value: c.count })),
    ...(restCount > 0 ? [{ name: "Other (combined)", value: restCount }] : []),
  ];

  if (kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} stroke={CHART_SURFACE} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function InterviewFunnelChart({ data, kind }: { data: ProgressChartData["interviewFunnel"]; kind: ChartKind }) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <p className="mt-6 text-sm text-slate-400">No interviews tracked yet.</p>;
  }
  const chartData = data.map((s) => ({ name: STAGE_LABELS[s.stage] ?? s.stage, value: s.count }));

  if (kind === "pie") {
    const nonZero = chartData.filter((d) => d.value > 0);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
            {nonZero.map((_, i) => (
              <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} stroke={CHART_SURFACE} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DailyStreakChart({ data, kind }: { data: ProgressChartData["dailyStreakHistory"]; kind: ChartKind }) {
  if (data.length === 0 || data[0].total === 0) {
    return <p className="mt-6 text-sm text-slate-400">No daily habits tracked yet.</p>;
  }
  const chartData = data.map((d) => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    completed: d.completed,
  }));

  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="completed" fill={ACCENT} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={4} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="completed" stroke={ACCENT} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StudyPlanCoverageChart({ data, kind }: { data: ProgressChartData["studyPlanCoverage"]; kind: ChartKind }) {
  const withTopics = data.filter((p) => p.percent !== null);
  if (data.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">No study plans tracked yet.</p>;
  }
  if (withTopics.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">No topics added to any plan yet.</p>;
  }
  const chartData = withTopics.map((p) => ({ name: p.plan, value: p.percent as number }));
  const ChartComp = kind === "line" ? LineChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComp data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
        {kind === "line" ? (
          <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={{ r: 4 }} />
        ) : (
          <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} />
        )}
      </ChartComp>
    </ResponsiveContainer>
  );
}

export function ChartsSection({
  data,
  initialPrefs,
}: {
  data: ProgressChartData | null;
  initialPrefs: ChartPrefs;
}) {
  const [prefs, setPrefs] = useState<ChartPrefs>({ ...DEFAULT_CHART_PREFS, ...initialPrefs });

  async function setKind(metric: ChartMetric, kind: ChartKind) {
    setPrefs((p) => ({ ...p, [metric]: kind }));
    await fetch("/api/progress/chart-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs: { [metric]: kind } }),
    });
  }

  if (!data) {
    return (
      <Card variant="solid" className="p-6">
        <p className="text-sm text-slate-300">Couldn't load your charts right now.</p>
      </Card>
    );
  }

  const renderers: Record<ChartMetric, ReactNode> = {
    categoryBreakdown: <CategoryBreakdownChart data={data.categoryBreakdown} kind={prefs.categoryBreakdown!} />,
    interviewFunnel: <InterviewFunnelChart data={data.interviewFunnel} kind={prefs.interviewFunnel!} />,
    dailyStreakHistory: <DailyStreakChart data={data.dailyStreakHistory} kind={prefs.dailyStreakHistory!} />,
    studyPlanCoverage: <StudyPlanCoverageChart data={data.studyPlanCoverage} kind={prefs.studyPlanCoverage!} />,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CHART_METRICS.map((metric) => (
        <ClientOnly key={metric} fallback={<ChartSkeleton variant={prefs[metric] === "pie" ? "circle" : "rect"} />}>
          <Card variant="solid" className="p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-accent">{METRIC_TITLES[metric]}</p>
              <ChartTypeSwitcher metric={metric} current={prefs[metric]!} onChange={(kind) => setKind(metric, kind)} />
            </div>
            <div className="mt-2 h-48">{renderers[metric]}</div>
          </Card>
        </ClientOnly>
      ))}
    </div>
  );
}
