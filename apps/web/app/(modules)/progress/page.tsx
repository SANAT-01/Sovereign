import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ProgressItem, ProgressDashboard } from "@/lib/progress-types";
import { ProgressBoard } from "@/components/progress/ProgressBoard";

export default async function ProgressPage() {
  // SSR auth check, same pattern as the dashboard/profile pages (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [dashboard, items] = await Promise.all([
    ssrGet<ProgressDashboard>("/progress/dashboard"),
    ssrGet<ProgressItem[]>("/progress/items"),
  ]);

  const attentionCount = dashboard
    ? dashboard.dailyAtRisk.length +
      dashboard.staleStudyTopics.length +
      dashboard.dueSoon.length +
      dashboard.staleInterviewsOrOther.length +
      dashboard.openOther.length
    : 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <p className="text-sm text-slate-400">Progress Tracker</p>
        <h1 className="text-2xl font-semibold text-white">What needs your attention</h1>

        {/* The dashboard/summary — the actual feature (APPROACH.md §10), the
            first thing seen on opening this module. */}
        <Card variant="solid" className="mt-4 p-6">
          {!dashboard ? (
            <p className="text-sm text-slate-300">Couldn't load your summary right now.</p>
          ) : attentionCount === 0 ? (
            <p className="text-sm text-slate-200">
              Nothing needs attention right now — either you're fully caught up, or nothing's
              been tracked yet. Add items below.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-slate-200">
              {dashboard.dailyAtRisk.map((h) => (
                <li key={h.id}>⚠️ &quot;{h.title}&quot; streak ({h.streak} days) is at risk today</li>
              ))}
              {dashboard.staleStudyTopics.map((t) => (
                <li key={t.id}>
                  📖 &quot;{t.title}&quot; ({t.planTitle}){" "}
                  {t.lastTouchedAt ? "hasn't been touched in a few days" : "has never been touched"}
                </li>
              ))}
              {dashboard.dueSoon.map((item) => (
                <li key={item.id}>
                  📅 &quot;{item.title}&quot; coming up
                  {item.due_at &&
                    ` on ${new Date(item.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                </li>
              ))}
              {dashboard.staleInterviewsOrOther.map((item) => (
                <li key={item.id}>💼 No update on &quot;{item.title}&quot; in 7+ days</li>
              ))}
              {dashboard.openOther.slice(0, 5).map((item) => (
                <li key={item.id}>📝 &quot;{item.title}&quot; is still open</li>
              ))}
            </ul>
          )}
        </Card>

        <div className="mt-6">
          <ProgressBoard initialItems={items ?? []} />
        </div>
      </main>
    </AppShell>
  );
}
