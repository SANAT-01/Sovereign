import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { TargetIcon } from "@/components/ui/icons";

export default function ProgressPage() {
  return (
    <AppShell>
      <ComingSoon label="Progress Tracker" icon={<TargetIcon />} />
    </AppShell>
  );
}
