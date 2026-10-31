// Mirrors apps/api/src/modules/progress (generic items model, APPROACH.md §10).

export type ItemType = "daily" | "study_plan" | "interview" | "other";
export type ItemStatus = "active" | "done" | "cancelled";

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
  dailyAtRisk: ProgressItem[];
  staleStudyTopics: (Topic & { planId: string; planTitle: string })[];
  dueSoon: ProgressItem[];
  staleInterviewsOrOther: ProgressItem[];
  openOther: ProgressItem[];
}
