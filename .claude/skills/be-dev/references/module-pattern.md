# Module Pattern — worked example

Every module (`expenses`, `notes`, `progress`, ...) follows this exact shape. Below is `expenses` as the reference implementation — copy the shape, not the specifics, for new modules.

## repository.ts — only this file touches the database
```ts
import { db } from '../../db/client';

export async function insertExpense(userId: string, data: { amount: number; category: string; note?: string }) {
  const [row] = await db.query(
    `INSERT INTO expenses_transactions (user_id, amount, category, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, data.amount, data.category, data.note ?? null],
  );
  return row;
}

export async function listExpensesForUser(userId: string) {
  return db.query(
    `SELECT * FROM expenses_transactions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
}
```
No business rules here — just reads and writes, scoped to this module's own tables (`expenses_*`), scoped to the given `userId`.

## service.ts — all business logic, no Express dependency
```ts
import * as repository from './repository';

export async function createExpense(userId: string, data: { amount: number; category: string; note?: string }) {
  if (data.amount <= 0) {
    throw new ValidationError('Amount must be positive');
  }
  return repository.insertExpense(userId, data);
}

export async function listExpenses(userId: string) {
  return repository.listExpensesForUser(userId);
}
```
Notice: plain functions, plain arguments, no `req`/`res`, no HTTP status codes. This is what makes them callable from a unit test, a route, or a future cron job without duplication. Throw typed errors (see `error-handling.md`) rather than returning ad hoc `{ error: ... }` objects — let the routing layer decide how to translate an error into an HTTP response.

## routes.ts — thin adapter only
```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware';
import * as service from './service';

const router = Router();

const createExpenseSchema = z.object({
  amount: z.number(),
  category: z.string(),
  note: z.string().optional(),
});

router.post('/expenses', requireAuth, async (req, res, next) => {
  try {
    const data = createExpenseSchema.parse(req.body);
    const expense = await service.createExpense(req.user.id, data);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

router.get('/expenses', requireAuth, async (req, res, next) => {
  try {
    const expenses = await service.listExpenses(req.user.id);
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

export default router;
```
Everything here is wiring: validate shape (Zod), pull `req.user.id` from the auth middleware, call the service, send the response. If you find yourself writing an `if` that isn't about HTTP mechanics (status codes, parsing), it belongs in `service.ts` instead.

## Wiring into the app
```ts
// server.ts
import expensesRouter from './modules/expenses/routes';
import notesRouter from './modules/notes/routes';

app.use('/expenses', expensesRouter);
app.use('/notes', notesRouter);
```

## Cross-module calls
If the `progress` module ever needs expense data (e.g. "show spending trend alongside habit streaks"), it imports and calls `expenses/service.ts`'s exported functions — it never queries `expenses_transactions` directly from its own `repository.ts`. This is the boundary that keeps modules extractable into separate services later (APPROACH.md §2).
