import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { HomeWidgetToggles } from "@/components/HomeWidgetToggles";
import { WalletIcon, NotesIcon, TargetIcon, BriefcaseIcon } from "@/components/ui/icons";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ProgressDashboard, ProgressChartData } from "@/lib/progress-types";
import type { ExpensesChartsResponse } from "@/lib/expenses-types";
import type { NoteListItem } from "@/lib/notes-types";
import type { PortfolioSection } from "@/lib/portfolio-types";
import { AreaSparkline, BarSparkline, type SparkPoint } from "@/components/ui/charts/Sparkline";

// Same validated palette used across the expense charts (ExpensesCharts.tsx)
// — teal for the accent/positive series everywhere in the app.
const ACCENT = "#2dd4a0";

// Matches the formatting already used across expenses components
// (ExpensesCharts.tsx etc.) — same currency convention everywhere.
function formatCurrency(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// iso is a plain YYYY-MM-DD (no time component) — parsing with `new
// Date(iso)` would read it as UTC midnight and can print the wrong day in a
// timezone behind UTC, so split and construct a local date instead (same
// fix as ExpensesCharts.tsx's formatDateShort).
function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const modules = [
  {
    href: "/expenses",
    label: "Expense Tracker",
    description: "Log spending and track categories.",
    icon: <WalletIcon />,
  },
  {
    href: "/notes",
    label: "Notes",
    description: "Free-form notes and journaling.",
    icon: <NotesIcon />,
  },
  {
    href: "/progress",
    label: "Progress Tracker",
    description: "Habits and goal check-ins.",
    icon: <TargetIcon />,
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    description: "Public-facing showcase site.",
    icon: <BriefcaseIcon />,
  },
];

export default async function DashboardPage() {
  // SSR auth check: Server Component calling the backend directly over the
  // internal network (APPROACH.md §6), forwarding cookies for session
  // recognition. No user → bounce to /login.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Home is a curated summary, not a fixed dashboard — only fetch (and
  // show) a module's summary if the user actually enabled it
  // (APPROACH.md §10, HomeWidgetToggles). One Promise.all so the four
  // widgets' requests run concurrently rather than waterfalling.
  const [progressDashboard, progressCharts, expensesCharts, notes, portfolioSections] = await Promise.all([
    user.homeWidgets.includes("progress") ? ssrGet<ProgressDashboard>("/progress/dashboard") : null,
    user.homeWidgets.includes("progress") ? ssrGet<ProgressChartData>("/progress/charts") : null,
    user.homeWidgets.includes("expenses") ? ssrGet<ExpensesChartsResponse>("/expenses/charts") : null,
    user.homeWidgets.includes("notes") ? ssrGet<NoteListItem[]>("/notes") : null,
    user.homeWidgets.includes("portfolio") ? ssrGet<{ sections: PortfolioSection[] }>("/portfolio") : null,
  ]);

  // Sparkline data is built here (Server Component) as plain objects, not
  // functions — AreaSparkline/BarSparkline are Client Components, and a
  // function prop can't cross that boundary, only data. So every label/
  // display string is formatted up front, server-side.
  //
  // Last 14 days' completion % across every daily habit — null (not 0) on
  // a day with no daily items yet, same "don't fabricate" distinction the
  // progress module itself uses, so an empty bar reads as "no data" rather
  // than "0% completed".
  const completionSpark: SparkPoint[] | undefined = progressCharts?.dailyStreakHistory.slice(-14).map((d) => {
    const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : null;
    return {
      y: pct,
      label: formatDateShort(d.date),
      display: pct === null ? "No habits tracked" : `${pct}% completed`,
    };
  });

  const balanceSpark: SparkPoint[] | undefined = expensesCharts?.days.slice(-30).map((d) => ({
    y: d.balance,
    label: formatDateShort(d.date),
    display: formatCurrency(d.balance),
  }));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user.avatarUrls ? (
              // eslint-disable-next-line @next/next/no-img-element -- external MinIO URL, not a static asset next/image can optimize
              <img
                // "small" (96px source) for a 48px display slot — a little
                // headroom for retina displays without serving "large".
                src={user.avatarUrls.small}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {(user.displayName || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-slate-400">Good to see you</p>
              <h1 className="text-2xl font-semibold text-white">{user.displayName || user.email}</h1>
            </div>
          </div>
          <HomeWidgetToggles initialWidgets={user.homeWidgets} />
        </div>

        {/* Home is a curated summary (APPROACH.md §10) — only modules the
            user enabled via HomeWidgetToggles show a summary card here. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {progressDashboard && (
            <Card variant="solid" className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent">Progress Tracker</p>
                <Link href="/progress" className="text-xs text-slate-300 hover:text-white">
                  View all →
                </Link>
              </div>
              {(() => {
                const attentionCount =
                  progressDashboard.dailyAtRisk.length +
                  progressDashboard.staleStudyTopics.length +
                  progressDashboard.dueSoon.length +
                  progressDashboard.staleInterviewsOrOther.length +
                  progressDashboard.openOther.length;
                return attentionCount === 0 ? (
                  <p className="mt-2 text-sm text-slate-200">
                    Nothing needs attention — you're caught up, or haven't started tracking yet.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-200">
                    {attentionCount} thing{attentionCount === 1 ? "" : "s"} waiting on you — habits,
                    topics, events, applications, or plans.
                  </p>
                );
              })()}
              {completionSpark && completionSpark.some((d) => d.y !== null) && (
                <div className="mt-3">
                  <p className="text-[11px] text-slate-500">Daily habit completion, last 14 days</p>
                  <BarSparkline data={completionSpark} color={ACCENT} />
                </div>
              )}
            </Card>
          )}

          {expensesCharts && (
            <Card variant="solid" className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent">Expense Tracker</p>
                <Link href="/expenses" className="text-xs text-slate-300 hover:text-white">
                  View all →
                </Link>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-200">
                <span>
                  In <span className="font-medium text-emerald-300">{formatCurrency(expensesCharts.stats.income)}</span>
                </span>
                <span>
                  Out <span className="font-medium text-red-300">{formatCurrency(expensesCharts.stats.expense)}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Balance {formatCurrency(expensesCharts.stats.balance)}</p>
              {balanceSpark && balanceSpark.length > 1 && (
                <div className="mt-3">
                  <p className="text-[11px] text-slate-500">Balance, last {Math.min(balanceSpark.length, 30)} days</p>
                  <AreaSparkline data={balanceSpark} color={ACCENT} />
                </div>
              )}
            </Card>
          )}

          {notes && (
            <Card variant="solid" className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent">Notes</p>
                <Link href="/notes" className="text-xs text-slate-300 hover:text-white">
                  View all →
                </Link>
              </div>
              {notes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-200">No notes yet.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-200">
                    {notes.length} note{notes.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    Last edited {formatRelativeDate(notes[0].updatedAt)} — {notes[0].title || "Untitled"}
                  </p>
                </>
              )}
            </Card>
          )}

          {portfolioSections && (
            <Card variant="solid" className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent">Portfolio</p>
                <Link href="/portfolio" className="text-xs text-slate-300 hover:text-white">
                  View all →
                </Link>
              </div>
              {(() => {
                const sections = portfolioSections.sections;
                const itemCount = sections.reduce((sum, s) => sum + s.items.length, 0);
                return sections.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-200">Nothing added yet.</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-200">
                    {sections.length} section{sections.length === 1 ? "" : "s"}, {itemCount} item{itemCount === 1 ? "" : "s"}
                  </p>
                );
              })()}
            </Card>
          )}
        </div>

        {/* Module tiles — quick navigation to every module, regardless of
            whether its summary widget above is enabled. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <ModuleCard key={mod.href} {...mod} />
          ))}
        </div>
      </main>
    </AppShell>
  );
}
