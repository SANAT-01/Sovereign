import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { NoteListItem } from "@/lib/notes-types";
import { NotesBoard } from "@/components/notes/NotesBoard";

export default async function NotesPage() {
  // SSR auth check, same pattern as every other real module (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notes = await ssrGet<NoteListItem[]>("/notes");

  return (
    <AppShell>
      {/* Full-height two-pane layout (APPROACH.md §18) rather than the
          padded max-w-3xl flow layout other module pages use — a notes
          app needs the work area, not a narrow column. */}
      <main className="h-[calc(100vh-3.5rem)] px-3 py-3 sm:px-4 sm:py-4 lg:h-screen lg:px-6 lg:py-6">
        <NotesBoard initialNotes={notes ?? []} />
      </main>
    </AppShell>
  );
}
