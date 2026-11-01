import { db } from '../../db/client.js';

export interface Expense {
  id: string;
  user_id: string;
  date: string;
  details: string;
  ref_no: string | null;
  debit: string | null;
  credit: string | null;
  balance: string;
  counterparty_name: string | null;
  upi_id: string | null;
  merchant_name: string | null;
  created_at: Date;
}

export interface ExpenseInput {
  date: string;
  details: string;
  refNo: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  counterpartyName: string | null;
  upiId: string | null;
  merchantName: string | null;
}

export type SortColumn = 'date' | 'debit' | 'credit' | 'balance' | 'counterparty_name';
export type SortDirection = 'asc' | 'desc';
export type TypeFilter = 'all' | 'debit' | 'credit';

export interface ListQuery {
  page: number;
  pageSize: number;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  search?: string;
  type: TypeFilter;
  dateFrom?: string;
  dateTo?: string;
}

// Column names can't be parameterized — an explicit map (not a raw
// interpolated value) keeps this closed to anything the caller sends,
// even though ListQuery's own type already restricts it.
const SORT_COLUMNS: Record<SortColumn, string> = {
  date: 'date',
  debit: 'debit',
  credit: 'credit',
  balance: 'balance',
  counterparty_name: 'counterparty_name',
};

export async function listExpensesPaged(
  userId: string,
  query: ListQuery,
): Promise<{ rows: Expense[]; total: number }> {
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];

  if (query.type === 'debit') {
    conditions.push('debit IS NOT NULL');
  } else if (query.type === 'credit') {
    conditions.push('credit IS NOT NULL');
  }
  if (query.dateFrom) {
    params.push(query.dateFrom);
    conditions.push(`date >= $${params.length}`);
  }
  if (query.dateTo) {
    params.push(query.dateTo);
    conditions.push(`date <= $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(details ILIKE ${p} OR counterparty_name ILIKE ${p} OR merchant_name ILIKE ${p} OR upi_id ILIKE ${p})`,
    );
  }

  const whereClause = conditions.join(' AND ');
  const orderColumn = SORT_COLUMNS[query.sortColumn];
  const orderDir = query.sortDirection === 'asc' ? 'ASC' : 'DESC';

  params.push(query.pageSize);
  const limitParam = `$${params.length}`;
  params.push((query.page - 1) * query.pageSize);
  const offsetParam = `$${params.length}`;

  // COUNT(*) OVER() rides along with the page of rows — one query instead
  // of two round trips for "rows" + "total".
  const result = await db.query<Expense & { total_count: string }>(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM expenses
     WHERE ${whereClause}
     ORDER BY ${orderColumn} ${orderDir} NULLS LAST, created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);
  return { rows, total };
}

// IS NOT DISTINCT FROM, not `=` — debit/credit are legitimately NULL on
// half of every row (one or the other, never both), and `NULL = NULL` is
// NULL (never true) in SQL, which would silently defeat the dedupe check.
export async function exists(
  userId: string,
  row: { date: string; debit: number | null; credit: number | null; balance: number },
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM expenses
     WHERE user_id = $1 AND date = $2
       AND debit IS NOT DISTINCT FROM $3
       AND credit IS NOT DISTINCT FROM $4
       AND balance = $5
     LIMIT 1`,
    [userId, row.date, row.debit, row.credit, row.balance],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertExpense(userId: string, row: ExpenseInput): Promise<Expense> {
  const result = await db.query<Expense>(
    `INSERT INTO expenses (user_id, date, details, ref_no, debit, credit, balance, counterparty_name, upi_id, merchant_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      row.date,
      row.details,
      row.refNo,
      row.debit,
      row.credit,
      row.balance,
      row.counterpartyName,
      row.upiId,
      row.merchantName,
    ],
  );
  return result.rows[0];
}

export async function deleteExpense(userId: string, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM expenses WHERE user_id = $1 AND id = $2', [userId, id]);
  return (result.rowCount ?? 0) > 0;
}

export interface ChartRangeQuery {
  dateFrom?: string;
  dateTo?: string;
}

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

function rangeConditions(userId: string, range: ChartRangeQuery, extra: string[] = []): { where: string; params: unknown[] } {
  const conditions = ['user_id = $1', ...extra];
  const params: unknown[] = [userId];
  if (range.dateFrom) {
    params.push(range.dateFrom);
    conditions.push(`date >= $${params.length}`);
  }
  if (range.dateTo) {
    params.push(range.dateTo);
    conditions.push(`date <= $${params.length}`);
  }
  return { where: conditions.join(' AND '), params };
}

// One row per calendar day in range. Balance is the day's *last* transaction
// balance, not a sum — ordered by created_at, which tracks original
// sheet-row order since import inserts rows sequentially (APPROACH.md §20).
export async function getDailySeries(userId: string, range: ChartRangeQuery): Promise<DailyPoint[]> {
  const { where, params } = rangeConditions(userId, range);
  const result = await db.query<{ date: string; expense: string; income: string; balance: string }>(
    `SELECT date,
        COALESCE(SUM(debit), 0) AS expense,
        COALESCE(SUM(credit), 0) AS income,
        (ARRAY_AGG(balance ORDER BY created_at DESC))[1] AS balance
     FROM expenses
     WHERE ${where}
     GROUP BY date
     ORDER BY date ASC`,
    params,
  );
  return result.rows.map((r) => ({
    date: r.date,
    expense: Number(r.expense),
    income: Number(r.income),
    balance: Number(r.balance),
  }));
}

export async function getMonthlySeries(userId: string, range: ChartRangeQuery): Promise<MonthlyPoint[]> {
  const { where, params } = rangeConditions(userId, range);
  const result = await db.query<{ month: string; expense: string; income: string }>(
    `SELECT to_char(date, 'YYYY-MM') AS month,
        COALESCE(SUM(debit), 0) AS expense,
        COALESCE(SUM(credit), 0) AS income
     FROM expenses
     WHERE ${where}
     GROUP BY month
     ORDER BY month ASC`,
    params,
  );
  return result.rows.map((r) => ({ month: r.month, expense: Number(r.expense), income: Number(r.income) }));
}

export async function getTopMerchants(
  userId: string,
  range: ChartRangeQuery,
  limit = 8,
): Promise<MerchantPoint[]> {
  const { where, params } = rangeConditions(userId, range, ['debit IS NOT NULL']);
  params.push(limit);
  const result = await db.query<{ name: string; amount: string }>(
    `SELECT COALESCE(merchant_name, counterparty_name, 'Unknown') AS name,
        SUM(debit) AS amount
     FROM expenses
     WHERE ${where}
     GROUP BY name
     ORDER BY amount DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((r) => ({ name: r.name, amount: Number(r.amount) }));
}

export interface ExpensePatch {
  date?: string;
  details?: string;
  refNo?: string | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number;
  counterpartyName?: string | null;
  upiId?: string | null;
  merchantName?: string | null;
}

export async function updateExpense(userId: string, id: string, patch: ExpensePatch): Promise<Expense | null> {
  const result = await db.query<Expense>(
    `UPDATE expenses SET
       date = COALESCE($3, date),
       details = COALESCE($4, details),
       ref_no = CASE WHEN $5::boolean THEN $6 ELSE ref_no END,
       debit = CASE WHEN $7::boolean THEN $8 ELSE debit END,
       credit = CASE WHEN $9::boolean THEN $10 ELSE credit END,
       balance = COALESCE($11, balance),
       counterparty_name = CASE WHEN $12::boolean THEN $13 ELSE counterparty_name END,
       upi_id = CASE WHEN $14::boolean THEN $15 ELSE upi_id END,
       merchant_name = CASE WHEN $16::boolean THEN $17 ELSE merchant_name END
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [
      userId,
      id,
      patch.date ?? null,
      patch.details ?? null,
      patch.refNo !== undefined,
      patch.refNo ?? null,
      patch.debit !== undefined,
      patch.debit ?? null,
      patch.credit !== undefined,
      patch.credit ?? null,
      patch.balance ?? null,
      patch.counterpartyName !== undefined,
      patch.counterpartyName ?? null,
      patch.upiId !== undefined,
      patch.upiId ?? null,
      patch.merchantName !== undefined,
      patch.merchantName ?? null,
    ],
  );
  return result.rows[0] ?? null;
}
