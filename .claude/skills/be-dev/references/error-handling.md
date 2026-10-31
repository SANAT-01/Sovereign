# Error Handling

## Typed errors from service.ts
Define a small set of error classes once, shared across all modules, and throw them from `service.ts`:

```ts
// /apps/api/src/errors.ts
export class ValidationError extends Error {
  status = 400;
}
export class NotFoundError extends Error {
  status = 404;
}
export class ForbiddenError extends Error {
  status = 403;
}
```

`service.ts` throws these for business-rule failures:
```ts
if (data.amount <= 0) throw new ValidationError('Amount must be positive');
if (!expense) throw new NotFoundError('Expense not found');
if (expense.userId !== userId) throw new ForbiddenError('Not your expense');
```

## One error-handling middleware, used by every module
```ts
// /apps/api/src/middleware/errorHandler.ts
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid request', details: err.errors });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err); // unexpected error — log full detail server-side
  res.status(500).json({ error: 'Internal server error' }); // never leak internals to the client
}
```

Register it last, after all module routers:
```ts
app.use('/expenses', expensesRouter);
app.use('/notes', notesRouter);
app.use(errorHandler);
```

## Rules
- Every `routes.ts` handler wraps its body in `try { ... } catch (err) { next(err); }` — never swallow an error silently, and never format error responses ad hoc per route.
- Async route handlers must call `next(err)` on failure — Express does not catch rejected promises automatically. If a route forgets this, a failed async call hangs or crashes the process instead of returning a clean error response.
- Unexpected (non-typed) errors return a generic `500` to the client but get fully logged server-side — don't leak stack traces or internal messages to API consumers.
