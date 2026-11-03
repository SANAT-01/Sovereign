"use client";

import { useId, type CSSProperties } from "react";
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";

// Same tooltip surface as the full-size expense charts (ExpensesCharts.tsx)
// — one consistent look for every chart in the app, mini or not.
const TOOLTIP_STYLE: CSSProperties = {
  background: "#16201f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 11,
  padding: "4px 8px",
  color: "#fff",
};

// `label`/`display` are pre-formatted strings, not formatter functions —
// this component is "use client", and a Server Component caller (e.g.
// app/page.tsx) can't pass a function as a prop across that boundary, only
// plain data. Callers format once, server-side, before handing this the array.
export interface SparkPoint {
  y: number | null;
  label: string;
  display: string;
}

interface MiniTooltipProps {
  active?: boolean;
  payload?: { payload: SparkPoint }[];
}

// No axes, no grid, no legend — a single-series sparkline's title already
// names the series (dataviz skill: a lone series needs no legend box), so
// the only thing worth surfacing is the point under the cursor.
function MiniTooltip({ active, payload }: MiniTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: "#94a3b8" }}>{point.label}</div>
      <div>{point.display}</div>
    </div>
  );
}

interface SparklineProps {
  data: SparkPoint[];
  color: string;
  height?: number;
}

// A compact area trend — e.g. balance over the last N days inside a home
// dashboard card, where a full axis/grid chart would overwhelm the card.
export function AreaSparkline({ data, color, height = 48 }: SparklineProps) {
  const gradientId = useId();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="y"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip content={<MiniTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// A compact bar trend — e.g. daily completion % inside a home dashboard
// card, where each bar is one day rather than a continuous line.
export function BarSparkline({ data, color, height = 48 }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
        <Bar dataKey="y" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Tooltip content={<MiniTooltip />} cursor={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
