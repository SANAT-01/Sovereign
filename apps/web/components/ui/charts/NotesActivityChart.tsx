"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../Card";

// Sample data shaped like the notes module's future "notes created per
// day" response. See ExpenseTrendChart.tsx for the swap-to-real-data note.
const sampleNotesActivity = [
  { day: "Mon", count: 2 },
  { day: "Tue", count: 1 },
  { day: "Wed", count: 4 },
  { day: "Thu", count: 0 },
  { day: "Fri", count: 3 },
  { day: "Sat", count: 1 },
  { day: "Sun", count: 2 },
];

export function NotesActivityChart() {
  return (
    <Card variant="glass" className="p-6">
      <p className="text-sm font-medium text-accent">Notes Activity</p>
      <p className="mt-1 text-xs text-slate-400">
        Sample data — will reflect real notes once the Notes module is built.
      </p>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sampleNotesActivity} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                background: "#0d3b36",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 12,
                color: "#fff",
              }}
            />
            <Bar dataKey="count" fill="#2dd4a0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
