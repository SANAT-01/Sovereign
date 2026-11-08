import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ResumeJobsResponse, ResumeProfile } from "@/lib/resume-types";
import { ResumeTailorBoard } from "@/components/resume/ResumeTailorBoard";

export default async function ResumePage() {
  // SSR auth check, same pattern as every other module (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Both in parallel: neither depends on the other.
  const [data, profile] = await Promise.all([
    ssrGet<ResumeJobsResponse>("/resume/jobs"),
    ssrGet<ResumeProfile>("/resume/profile"),
  ]);

  return (
    <AppShell>
      <main className="px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-white">Resume Tailoring</h1>
            <p className="text-xs text-slate-400">
              Attach your .tex, your PDF, or both. Results land in a Drive folder named after the company.
            </p>
          </div>
          <ResumeTailorBoard initialJobs={data?.jobs ?? []} initialProfile={profile} />
        </div>
      </main>
    </AppShell>
  );
}
