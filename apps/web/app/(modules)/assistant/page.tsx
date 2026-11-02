import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ChatMessagesPage } from "@/lib/assistant-types";
import { ChatBoard } from "@/components/assistant/ChatBoard";

export default async function AssistantPage() {
  // SSR auth check, same pattern as every other module (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Only the most recent page (10) loads up front — older history is
  // fetched on demand as the user scrolls up (ChatBoard.tsx).
  const page = await ssrGet<ChatMessagesPage>("/assistant/messages");

  return (
    <AppShell>
      <main className="h-[calc(100vh-3.5rem)] px-3 py-3 sm:px-4 sm:py-4 lg:h-screen lg:px-6 lg:py-6">
        <div className="mx-auto flex h-full max-w-2xl min-h-0 flex-col rounded-3xl border border-white/10 bg-surface-card/55 backdrop-blur-xl">
          <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
            <h1 className="text-lg font-semibold text-white">Assistant</h1>
            <p className="text-xs text-slate-400">Answers questions about your own notes, progress, and portfolio.</p>
          </div>
          <ChatBoard initialMessages={page?.messages ?? []} initialHasMore={page?.hasMore ?? false} />
        </div>
      </main>
    </AppShell>
  );
}
