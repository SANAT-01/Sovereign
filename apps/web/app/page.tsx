import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { HomeWidgetToggles } from "@/components/HomeWidgetToggles";
import { WalletIcon, NotesIcon, TargetIcon, BriefcaseIcon } from "@/components/ui/icons";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ProgressDashboard } from "@/lib/progress-types";

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
  // (APPROACH.md §10, HomeWidgetToggles).
  const progressDashboard = user.homeWidgets.includes("progress")
    ? await ssrGet<ProgressDashboard>("/progress/dashboard")
    : null;

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
        {progressDashboard && (
          <Card variant="solid" className="mt-6 p-6">
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
          </Card>
        )}

        {/* Bento grid: a wide hero/summary card alongside the module tiles,
            varying sizes per visual-style.md rather than a uniform list. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card variant="solid" className="p-6 sm:col-span-2 lg:col-span-4">
            <p className="text-sm font-medium text-accent">Welcome</p>
            <p className="mt-1 text-slate-200">
              Pick a module below to get started. Each one is being built out
              module by module — this is the shared dashboard shell.
            </p>
          </Card>

          {modules.map((mod) => (
            <ModuleCard key={mod.href} {...mod} />
          ))}
        </div>
      </main>
    </AppShell>
  );
}
