import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import type { User } from '../users/repository.js';
import * as service from './service.js';

const router = Router();
router.use(requireAuth);

// In-memory storage — the uploaded sheet is parsed immediately and never
// written to disk, same pattern as avatar/document uploads elsewhere.
const upload = multer({ storage: multer.memoryStorage() });

function userId(req: { user?: unknown }): string {
  return (req.user as User).id;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => service.ALLOWED_PAGE_SIZES.includes(n as never), {
      message: `pageSize must be one of ${service.ALLOWED_PAGE_SIZES.join(', ')}`,
    })
    .transform((n) => n as (typeof service.ALLOWED_PAGE_SIZES)[number])
    .optional(),
  sort: z.enum(['date', 'debit', 'credit', 'balance', 'counterparty_name']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  // Capped — an unbounded search string is needless abuse surface for a
  // value that only ever feeds an ILIKE.
  search: z.string().max(200).optional(),
  type: z.enum(['all', 'debit', 'credit']).optional(),
  from: z.string().regex(DATE_RE, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(DATE_RE, 'to must be YYYY-MM-DD').optional(),
});

router.get('/expenses', async (req, res, next) => {
  try {
    const query = listExpensesQuerySchema.parse(req.query);
    res.json(await service.listExpenses(userId(req), query));
  } catch (err) {
    next(err);
  }
});

const chartsQuerySchema = z.object({
  from: z.string().regex(DATE_RE, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(DATE_RE, 'to must be YYYY-MM-DD').optional(),
});

router.get('/expenses/charts', async (req, res, next) => {
  try {
    const query = chartsQuerySchema.parse(req.query);
    res.json(await service.getChartData(userId(req), query));
  } catch (err) {
    next(err);
  }
});

router.get('/expenses/template', async (_req, res, next) => {
  try {
    const buffer = await service.generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="expense-import-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/expenses/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json(await service.importExpenses(userId(req), req.file.buffer));
  } catch (err) {
    next(err);
  }
});

const updateExpenseSchema = z.object({
  date: z.string().optional(),
  details: z.string().optional(),
  refNo: z.string().nullable().optional(),
  debit: z.number().nullable().optional(),
  credit: z.number().nullable().optional(),
  balance: z.number().optional(),
  counterpartyName: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  merchantName: z.string().nullable().optional(),
});
router.patch('/expenses/:id', async (req, res, next) => {
  try {
    const patch = updateExpenseSchema.parse(req.body);
    res.json(await service.updateExpense(userId(req), req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

router.delete('/expenses/:id', async (req, res, next) => {
  try {
    await service.deleteExpense(userId(req), req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
