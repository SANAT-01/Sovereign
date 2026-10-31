# Integration Testing (routes.ts, Supertest)

## What this layer is for
Verify the HTTP contract — status codes, request validation, auth gating, response shape — not business logic (already covered by unit tests on `service.ts`). Keep these tests focused on "does the route correctly wire the request to the service and translate the result back," not on re-testing business rules.

## Setup
```ts
import request from 'supertest';
import { app } from '../src/server';
import { testDb, seedUser, loginAs } from '../test/helpers';

describe('POST /expenses', () => {
  let agent: request.Agent;
  let userId: string;

  beforeEach(async () => {
    userId = await seedUser(testDb);
    agent = request.agent(app); // persists cookies across requests, needed for session auth
    await loginAs(agent, userId); // test helper that establishes a session without the real Google OAuth round-trip
  });

  it('returns 201 and the created expense for valid input', async () => {
    const res = await agent.post('/expenses').send({ amount: 20, category: 'groceries' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(20);
  });

  it('returns 400 for invalid input', async () => {
    const res = await agent.post('/expenses').send({ amount: 'not-a-number' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/expenses').send({ amount: 20, category: 'groceries' });
    expect(res.status).toBe(401);
  });
});
```

## Testing auth-gated routes without hitting real Google OAuth
Write a test-only helper that directly establishes a session (e.g. by calling `req.login()` programmatically against a test route, or seeding the session store directly) rather than driving the actual Google OAuth redirect flow in integration tests — that flow belongs at the manual/e2e level (see `oauth-setup` skill's troubleshooting notes on why it can't be fully mocked) and is too slow/external-dependent for a fast test suite.

## Database state between tests
Same approach as unit tests — truncate relevant tables in `beforeEach`, don't rely on test execution order for data setup.
