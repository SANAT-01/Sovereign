import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { BriefcaseIcon } from "@/components/ui/icons";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { PortfolioSection } from "@/lib/portfolio-types";
import { PortfolioBoard } from "@/components/portfolio/PortfolioBoard";

export default async function PortfolioPage() {
  // SSR auth check, same pattern as every other real module (APPROACH.md §6,
  // §9's correction from the original "public, no auth" placeholder).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const board = await ssrGet<{ sections: PortfolioSection[] }>("/portfolio");

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Card className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="liquid-bubble flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-accent">
              <BriefcaseIcon width={22} height={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent/80">Portfolio</p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Your career kit</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300/80">
                Every link, document, and detail you need when filling out a job application — one click to
                copy, instead of opening five tabs.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-5">
          <PortfolioBoard initialSections={board?.sections ?? []} />
        </div>
      </main>
    </AppShell>
  );
}
