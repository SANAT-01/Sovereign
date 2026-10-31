import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { WalletIcon } from "@/components/ui/icons";

export default function ExpensesPage() {
  return (
    <AppShell>
      <ComingSoon label="Expense Tracker" icon={<WalletIcon />} />
    </AppShell>
  );
}
