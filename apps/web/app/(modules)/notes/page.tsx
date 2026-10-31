import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { NotesIcon } from "@/components/ui/icons";

export default function NotesPage() {
  return (
    <AppShell>
      <ComingSoon label="Notes" icon={<NotesIcon />} />
    </AppShell>
  );
}
