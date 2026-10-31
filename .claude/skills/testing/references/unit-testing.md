# Unit Testing (service.ts, Vitest)

## Real test DB vs. mocked DB client
For this project's scale, prefer a **real test database** (a separate Postgres instance/schema, migrated the same way as dev/prod, truncated between tests) over mocking the DB client. Mocking SQL calls tends to test "did I call the mock correctly" rather than "does this logic actually work against real data" — and `service.ts` functions are thin enough that a real DB round-trip is fast.

```ts
// test setup — truncate relevant tables before each test
beforeEach(async () => {
  await testDb.query('TRUNCATE expenses_transactions CASCADE');
});
```

## Example
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as service from '../src/modules/expenses/service';
import { testDb, seedUser } from '../test/helpers';

describe('expenses service', () => {
  let userId: string;

  beforeEach(async () => {
    userId = await seedUser(testDb);
  });

  it('creates an expense with valid data', async () => {
    const expense = await service.createExpense(userId, { amount: 42, category: 'groceries' });
    expect(expense.amount).toBe(42);
  });

  it('rejects a non-positive amount', async () => {
    await expect(
      service.createExpense(userId, { amount: -5, category: 'groceries' }),
    ).rejects.toThrow('Amount must be positive');
  });

  it('only returns expenses for the requesting user', async () => {
    const otherUserId = await seedUser(testDb);
    await service.createExpense(otherUserId, { amount: 10, category: 'food' });
    const myExpenses = await service.listExpenses(userId);
    expect(myExpenses).toHaveLength(0);
  });
});
```

## What to cover
- Every business rule/branch in `service.ts` (validation failures, permission checks, edge cases like zero/negative amounts, empty strings).
- Cross-module calls, if any — e.g. if `progress/service.ts` calls into `expenses/service.ts`, test that integration at this layer rather than only at e2e.
- Don't bother unit-testing `repository.ts` in isolation if it's trivial passthrough SQL — it gets exercised indirectly through the service tests above. Write a repository-level test only if a query has real logic (a join, an aggregation) worth verifying on its own.
