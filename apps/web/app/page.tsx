import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { ExpenseTrendChart } from "@/components/ui/charts/ExpenseTrendChart";
import { ProgressGauge } from "@/components/ui/charts/ProgressGauge";
import { NotesActivityChart } from "@/components/ui/charts/NotesActivityChart";
import { ChartSkeleton } from "@/components/ui/charts/ChartSkeleton";
import { WalletIcon, NotesIcon, TargetIcon, BriefcaseIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/api";

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

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-8 py-10">
        <p className="text-sm text-slate-400">Good to see you</p>
        <h1 className="text-2xl font-semibold text-white">{user.name || user.email}</h1>

        {/* Bento grid: a wide hero/summary card alongside the module tiles,
            varying sizes per visual-style.md rather than a uniform list. */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Chart widgets — placeholder/sample data, per visual-style.md's
            "Dashboard charts — current phase" note. These will swap to real
            data once each module's API exists, without redesigning the
            widgets themselves.

            Each is wrapped in <ClientOnly>: Recharts assigns internal
            clipPath/gradient ids from a global counter that isn't
            guaranteed to match between the server render and the client
            render when several chart instances share a page, which causes
            a hydration mismatch unrelated to our own markup. Rendering
            these client-only (with a same-shape skeleton as the SSR
            fallback) is the correct fix per hydration-error.md — not
            disabling SSR for the whole page or suppressing the warning. */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ClientOnly fallback={<ChartSkeleton />}>
            <ExpenseTrendChart />
          </ClientOnly>
          <ClientOnly fallback={<ChartSkeleton />}>
            <NotesActivityChart />
          </ClientOnly>
          <ClientOnly fallback={<ChartSkeleton variant="circle" />}>
            <ProgressGauge />
          </ClientOnly>
        </div>
      </main>
    </AppShell>
  );
}
