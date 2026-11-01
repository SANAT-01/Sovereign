// Mirrors apps/api/src/modules/expenses (APPROACH.md §20). Phase 1: import & log only.

export interface Expense {
  id: string;
  date: string;
  details: string;
  ref_no: string | null;
  debit: string | null;
  credit: string | null;
  balance: string;
  counterparty_name: string | null;
  upi_id: string | null;
  merchant_name: string | null;
  created_at: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface ExpensesListResponse {
  rows: Expense[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Phase 2: charts, read from GET /expenses/charts (APPROACH.md §20).
export interface DailyPoint {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expense: number;
}

export interface MerchantPoint {
  name: string;
  amount: number;
}

export interface ExpensesChartsResponse {
  days: DailyPoint[];
  monthly: MonthlyPoint[];
  topMerchants: MerchantPoint[];
  stats: { income: number; expense: number; net: number; balance: number };
}

// Per-merchant spend trend, read from GET /expenses/merchant-trend.
// One row per date, with one amount key per selected merchant — the shape
// Recharts wants for a multi-line chart.
export interface MerchantTrendDay {
  date: string;
  amounts: Record<string, number>;
}

export interface MerchantTrendResponse {
  merchants: string[];
  days: MerchantTrendDay[];
  totals: Record<string, number>;
}
