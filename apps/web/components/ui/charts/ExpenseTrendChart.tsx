"use client";

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../Card";

// Sample data shaped exactly like the expenses module's future API response
// (date + total spent that day). Swapping this for a real fetch later is a
// data-source change only — this component's shape doesn't need to change
// (ui-dev: visual-style.md "Dashboard charts — current phase").
const sampleExpenseTrend = [
  { date: "Oct 1", total: 42 },
  { date: "Oct 5", total: 68 },
  { date: "Oct 10", total: 51 },
  { date: "Oct 15", total: 94 },
  { date: "Oct 20", total: 73 },
  { date: "Oct 25", total: 110 },
  { date: "Oct 30", total: 88 },
];

export function ExpenseTrendChart() {
  return (
    <Card variant="solid" className="p-6">
      <p className="text-sm font-medium text-accent">Expense Trend</p>
      <p className="mt-1 text-xs text-slate-400">
        Sample data — will reflect real spending once the Expenses module is built.
      </p>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampleExpenseTrend} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4a0" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#2dd4a0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#16201f",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 12,
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#2dd4a0"
              strokeWidth={2}
              fill="url(#expenseFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
