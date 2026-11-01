import ExcelJS from 'exceljs';
import { ValidationError } from '../../errors.js';
import * as repository from './repository.js';

// The import's contract with the user's own Claude session (APPROACH.md
// §20) — exact column names and order. Changing this must stay in sync
// between generateTemplate() and importExpenses()'s validation.
export const TEMPLATE_HEADERS = [
  'Date',
  'Details',
  'Ref No/Cheque No',
  'Debit',
  'Credit',
  'Balance',
  'Counterparty Name',
  'UPI ID',
  'Merchant Name',
] as const;

export const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

// Already validated/coerced by routes.ts's zod schema (page is a number
// in range, pageSize is one of ALLOWED_PAGE_SIZES, sort/dir/type are
// closed enums, from/to are YYYY-MM-DD) — this layer trusts that shape
// rather than re-deriving it.
export interface ListExpensesInput {
  page?: number;
  pageSize?: (typeof ALLOWED_PAGE_SIZES)[number];
  sort?: repository.SortColumn;
  dir?: repository.SortDirection;
  search?: string;
  type?: repository.TypeFilter;
  from?: string;
  to?: string;
}

export async function listExpenses(userId: string, input: ListExpensesInput) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

  const { rows, total } = await repository.listExpensesPaged(userId, {
    page,
    pageSize,
    sortColumn: input.sort ?? 'date',
    sortDirection: input.dir ?? 'desc',
    type: input.type ?? 'all',
    search: input.search?.trim() || undefined,
    dateFrom: input.from,
    dateTo: input.to,
  });

  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface ChartQuery {
  from?: string;
  to?: string;
}

export async function getChartData(userId: string, query: ChartQuery) {
  const range = { dateFrom: query.from, dateTo: query.to };
  const [days, monthly, topMerchants] = await Promise.all([
    repository.getDailySeries(userId, range),
    repository.getMonthlySeries(userId, range),
    repository.getTopMerchants(userId, range),
  ]);

  const income = days.reduce((sum, d) => sum + d.income, 0);
  const expense = days.reduce((sum, d) => sum + d.expense, 0);
  const balance = days.length ? days[days.length - 1].balance : 0;

  return {
    days,
    monthly,
    topMerchants,
    stats: { income, expense, net: income - expense, balance },
  };
}

export async function listMerchants(userId: string, type: repository.TransactionType): Promise<string[]> {
  return repository.getDistinctMerchants(userId, type);
}

export const MAX_TREND_MERCHANTS = 5;

export interface MerchantTrendQuery {
  merchants: string[];
  type: repository.TransactionType;
  from?: string;
  to?: string;
}

export async function getMerchantTrend(userId: string, query: MerchantTrendQuery) {
  if (query.merchants.length === 0) {
    throw new ValidationError('Select at least one merchant.');
  }
  if (query.merchants.length > MAX_TREND_MERCHANTS) {
    throw new ValidationError(`Select up to ${MAX_TREND_MERCHANTS} merchants at a time.`);
  }

  const rows = await repository.getMerchantsDailySeries(userId, query.merchants, query.type, {
    dateFrom: query.from,
    dateTo: query.to,
  });

  // Pivot (date, merchant, amount) rows into one row per date with every
  // selected merchant as its own key — the shape a multi-line chart wants.
  const byDate = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)![r.merchant] = r.amount;
  }
  const days = Array.from(byDate.keys())
    .sort()
    .map((date) => {
      const amounts: Record<string, number> = {};
      for (const m of query.merchants) amounts[m] = byDate.get(date)?.[m] ?? 0;
      return { date, amounts };
    });

  const totals: Record<string, number> = {};
  for (const m of query.merchants) totals[m] = 0;
  for (const r of rows) totals[r.merchant] += r.amount;

  return { merchants: query.merchants, days, totals };
}

export async function updateExpense(userId: string, id: string, patch: repository.ExpensePatch) {
  if (patch.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) {
    throw new ValidationError('Date must be in YYYY-MM-DD format');
  }
  const updated = await repository.updateExpense(userId, id, patch);
  if (!updated) throw new ValidationError('Expense not found');
  return updated;
}

export async function deleteExpense(userId: string, id: string) {
  const deleted = await repository.deleteExpense(userId, id);
  if (!deleted) throw new ValidationError('Expense not found');
}

export async function generateTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');

  sheet.addRow([...TEMPLATE_HEADERS]);
  const headerRow = sheet.getRow(1);
  headerRow.font = { name: 'Arial', bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F1' } };
  });

  // One example row, per the "fill-in template needs a realistic example"
  // convention — shows the expected shape without being mistaken for real data.
  sheet.addRow([
    '01/04/2026',
    'Payment to Zepto',
    '',
    347.0,
    '',
    625507.83,
    'Zepto',
    'zeptonow.ezps@yesb',
    'Zepto',
  ]);
  sheet.getRow(2).font = { name: 'Arial', italic: true, color: { argb: 'FF888888' } };

  sheet.columns.forEach((col) => {
    col.width = 20;
  });
  sheet.getColumn(2).width = 32;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim();
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value ?? '').trim();
  if (!str) return null;
  // DD/MM/YYYY (Indian bank statement convention)
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const str = String(value).trim().replace(/,/g, '');
  if (!str || str === '-') return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function cellText(value: unknown): string | null {
  const str = String(value ?? '').trim();
  return str ? str : null;
}

export async function importExpenses(userId: string, fileBuffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationError('The uploaded file has no sheet to read.');

  const headerRow = sheet.getRow(1);
  const actualHeaders = TEMPLATE_HEADERS.map((_, i) => normalizeHeader(headerRow.getCell(i + 1).value));
  const expected = [...TEMPLATE_HEADERS];
  if (actualHeaders.some((h, i) => h.toLowerCase() !== expected[i].toLowerCase())) {
    throw new ValidationError(
      `Column headers don't match the template. Expected: ${expected.join(', ')}. Download the template and try again.`,
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    if (row.cellCount === 0 || !row.getCell(1).value) continue; // blank trailing row

    const date = parseDate(row.getCell(1).value);
    const balance = parseAmount(row.getCell(6).value);
    if (!date || balance === null) {
      errors.push(`Row ${rowNum}: missing or invalid Date/Balance — skipped.`);
      continue;
    }

    const debit = parseAmount(row.getCell(4).value);
    const credit = parseAmount(row.getCell(5).value);

    const alreadyExists = await repository.exists(userId, { date, debit, credit, balance });
    if (alreadyExists) {
      skipped++;
      continue;
    }

    await repository.insertExpense(userId, {
      date,
      details: cellText(row.getCell(2).value) ?? '',
      refNo: cellText(row.getCell(3).value),
      debit,
      credit,
      balance,
      counterpartyName: cellText(row.getCell(7).value),
      upiId: cellText(row.getCell(8).value),
      merchantName: cellText(row.getCell(9).value),
    });
    imported++;
  }

  return { imported, skipped, errors };
}
