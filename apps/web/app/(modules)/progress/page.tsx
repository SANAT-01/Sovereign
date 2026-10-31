import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ProgressItem, ProgressDashboard, ProgressChartData } from "@/lib/progress-types";
import { ProgressBoard } from "@/components/progress/ProgressBoard";
import { ChartsSection } from "@/components/progress/ChartsSection";

export default async function ProgressPage() {
  // SSR auth check, same pattern as the dashboard/profile pages (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // One Promise.all, one round trip per dataset — /progress/charts itself
  // is already a single aggregated endpoint for all 4 charts, rather than
  // one request per chart (see progress/service.ts's getChartData).
  const [dashboard, items, charts] = await Promise.all([
    ssrGet<ProgressDashboard>("/progress/dashboard"),
    ssrGet<ProgressItem[]>("/progress/items"),
    ssrGet<ProgressChartData>("/progress/charts"),
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
                <li key={h.id}>
                  ⚠️ &quot;{h.title}&quot; not done today
                  {h.streak && h.streak > 0 ? ` — ${h.streak} day streak at risk` : ""}
                </li>
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
          <ChartsSection data={charts} initialPrefs={user.chartPrefs} />
        </div>

        <div className="mt-6">
          <ProgressBoard initialItems={items ?? []} />
        </div>
      </main>
    </AppShell>
  );
}
