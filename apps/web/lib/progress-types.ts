// Mirrors apps/api/src/modules/progress (generic items model, APPROACH.md §10).

// "daily" | "study_plan" | "interview" get dedicated widgets (ItemCard.tsx);
// any other string is a user-defined category sharing the generic widget,
// grouped into its own section by that exact string (ProgressBoard.tsx) —
// full flexibility, no fixed list.
export type ItemType = string;
export const SPECIAL_ITEM_TYPES = ["daily", "study_plan", "interview"] as const;
export type ItemStatus = "active" | "done" | "cancelled";
export type ItemPriority = "low" | "medium" | "high";

export interface Topic {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "done";
  lastTouchedAt: string | null;
}

export type InterviewStage = "applied" | "referral_asked" | "interview" | "pending" | "accepted" | "rejected";

export interface ProgressItem {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  priority: ItemPriority;
  due_at: string | null;
  last_activity_at: string;
  data: Record<string, unknown>;
  created_at: string;
  // Enriched fields, present only for the matching type (service.ts's enrichItem):
  streak?: number;
  doneToday?: boolean;
  heatmap?: { date: string; completed: boolean }[];
  coveragePercent?: number | null; // study_plan
  staleTopics?: Topic[]; // study_plan
}

export interface ProgressDashboard {
  highPriority: ProgressItem[];
  dailyAtRisk: ProgressItem[];
  staleStudyTopics: (Topic & { planId: string; planTitle: string })[];
  dueSoon: ProgressItem[];
  staleInterviewsOrOther: ProgressItem[];
  openOther: ProgressItem[];
}

// Mirrors apps/api/src/modules/progress/service.ts's getChartData — one
// aggregated response for all 4 summary charts.
export interface ProgressChartData {
  categoryBreakdown: { category: string; count: number }[];
  interviewFunnel: { stage: InterviewStage; count: number }[];
  dailyStreakHistory: { date: string; completed: number; total: number }[];
  studyPlanCoverage: { plan: string; percent: number | null }[];
}

export const CHART_METRICS = ["categoryBreakdown", "interviewFunnel", "dailyStreakHistory", "studyPlanCoverage"] as const;
export type ChartMetric = (typeof CHART_METRICS)[number];
export type ChartKind = "bar" | "line" | "pie";
export type ChartPrefs = Partial<Record<ChartMetric, ChartKind>>;

// Mirrors apps/api/src/modules/progress/service.ts's CHART_METRIC_KINDS —
// pie is only offered where values are genuinely parts of one whole;
// the other two compare magnitudes across categories, where bar/line are
// both valid but pie would misrepresent independent values as proportional
// shares (dataviz skill: form follows the data's job).
export const CHART_METRIC_KINDS: Record<ChartMetric, readonly ChartKind[]> = {
  categoryBreakdown: ["pie", "bar"],
  interviewFunnel: ["bar", "pie"],
  dailyStreakHistory: ["line", "bar"],
  studyPlanCoverage: ["bar", "line"],
};

export const DEFAULT_CHART_PREFS: Record<ChartMetric, ChartKind> = {
  categoryBreakdown: "pie",
  interviewFunnel: "bar",
  dailyStreakHistory: "line",
  studyPlanCoverage: "bar",
};
