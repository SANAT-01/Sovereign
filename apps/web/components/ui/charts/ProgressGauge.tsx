"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Card } from "../Card";

// Sample value shaped like the progress module's future "today's
// completion %" response. See ExpenseTrendChart.tsx for the same note on
// swapping sample data for a real fetch later.
const sampleCompletionPct = 68;

export function ProgressGauge() {
  return (
    <Card variant="glass" className="flex flex-col items-center p-6">
      <p className="self-start text-sm font-medium text-accent">Today&apos;s Progress</p>
      <p className="self-start mt-1 text-xs text-slate-400">
        Sample data — will reflect real check-ins once Progress is built.
      </p>
      <div className="relative mt-2 h-32 w-32">
        <RadialBarChart
          width={128}
          height={128}
          cx={64}
          cy={64}
          innerRadius={48}
          outerRadius={62}
          barSize={10}
          data={[{ value: sampleCompletionPct, fill: "#2dd4a0" }]}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.08)" }} dataKey="value" cornerRadius={10} />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold text-white">{sampleCompletionPct}%</span>
        </div>
      </div>
    </Card>
  );
}
