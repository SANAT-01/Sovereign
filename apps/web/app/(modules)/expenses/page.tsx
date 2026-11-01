import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, ssrGet } from "@/lib/api";
import type { ExpensesChartsResponse, ExpensesListResponse } from "@/lib/expenses-types";
import { ExpensesBoard } from "@/components/expenses/ExpensesBoard";
import { ExpensesCharts } from "@/components/expenses/ExpensesCharts";
import { ExpensesHeatmap } from "@/components/expenses/ExpensesHeatmap";
import { ExpensesMerchantTrend } from "@/components/expenses/ExpensesMerchantTrend";

const EMPTY: ExpensesListResponse = { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
const EMPTY_CHARTS: ExpensesChartsResponse = {
  days: [],
  monthly: [],
  topMerchants: [],
  stats: { income: 0, expense: 0, net: 0, balance: 0 },
};

export default async function ExpensesPage() {
  // SSR auth check, same pattern as every other module (APPROACH.md §6).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Default params (page 1, 20/page, date desc, no filters) — matches
  // ExpensesBoard's own initial state, so the client doesn't immediately
  // re-fetch on mount.
  const [initialData, initialCharts] = await Promise.all([
    ssrGet<ExpensesListResponse>("/expenses?page=1&pageSize=20&sort=date&dir=desc&type=all"),
    ssrGet<ExpensesChartsResponse>("/expenses/charts"),
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <p className="text-sm text-slate-400">Expense Tracker</p>
        <h1 className="text-2xl font-semibold text-white">Spending overview</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Import a cleaned bank-statement export and see the trends below (APPROACH.md §20).
        </p>

        <div className="mt-6">
          <ExpensesCharts initialData={initialCharts ?? EMPTY_CHARTS} />
        </div>

        <ExpensesHeatmap />

        <ExpensesMerchantTrend type="debit" />

        <ExpensesMerchantTrend type="credit" />

        <h2 className="mt-10 text-lg font-semibold text-white">Transactions</h2>
        <div className="mt-4">
          <ExpensesBoard initialData={initialData ?? EMPTY} />
        </div>
      </main>
    </AppShell>
  );
}
