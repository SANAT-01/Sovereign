import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
        <p className="text-sm text-slate-400">Portfolio</p>
        <h1 className="text-2xl font-semibold text-white">Your career kit</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Every link, document, and detail you need when filling out a job application — one
          click to copy, instead of opening five tabs.
        </p>

        <div className="mt-6">
          <PortfolioBoard initialSections={board?.sections ?? []} />
        </div>
      </main>
    </AppShell>
  );
}
