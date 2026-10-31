# Request Validation (Zod)

## Where validation belongs
- **Shape/type validation** (is `amount` a number, is `category` a non-empty string, is this a valid date) — belongs in `routes.ts`, via a Zod schema. This is about whether the HTTP request is well-formed.
- **Business-rule validation** (is this amount within the user's budget, can this note be edited after being shared, is this category one the user is allowed to use) — belongs in `service.ts`. This is about whether the request makes sense given the domain, not whether it's shaped correctly.

A quick test: would this check make sense for a function called directly from a test or a cron job, with no HTTP involved? If yes, it's a business rule → `service.ts`. If it only makes sense in the context of "a JSON body arrived over HTTP" → `routes.ts`.

## Pattern
Define one Zod schema per endpoint, named clearly, colocated in `routes.ts` (or in a `schemas.ts` file in the module if there are many):

```ts
const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  note: z.string().max(500).optional(),
});
```

Note: `.positive()` here is borderline — simple shape constraints that Zod expresses naturally (positive number, max length, valid enum) are fine at this layer even though they're "business-ish," because they're about data shape, not application state. A rule like "amount must be positive AND the user hasn't exceeded their monthly category budget" is clearly a `service.ts` concern because it needs to look at other data.

## Centralized error handling for validation failures
Don't manually catch `ZodError` in every route. Let it propagate to the error-handling middleware (see `error-handling.md`), which maps `ZodError` to a `400` response consistently across all modules.

```ts
router.post('/expenses', requireAuth, async (req, res, next) => {
  try {
    const data = createExpenseSchema.parse(req.body); // throws ZodError on bad input
    const expense = await service.createExpense(req.user.id, data);
    res.status(201).json(expense);
  } catch (err) {
    next(err); // error middleware handles both ZodError and ValidationError
  }
});
```

## Params and query strings
Validate these too — don't trust `req.params.id` or `req.query.page` to be well-formed:

```ts
const idParamSchema = z.object({ id: z.string().uuid() });
const { id } = idParamSchema.parse(req.params);
```
