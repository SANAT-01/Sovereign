---
name: testing
description: Write or run tests for this project's backend services, API routes, or end-to-end flows. Use when adding test coverage for a feature or module.
---

# Testing

Rules from APPROACH.md §11 — follow these when adding or running tests.

## Tools by layer
- **`service.ts` (business logic)**: Vitest (or Jest) unit tests. No HTTP, no Express — call the plain functions directly with test arguments and a test DB client/mock. This is the cheapest layer to cover and should carry most of the business-rule test cases.
- **`routes.ts` (HTTP layer)**: Supertest integration tests — verify request validation, status codes, and that the route correctly calls through to the service.
- **End-to-end**: Playwright, through the actual UI. Reserve for the critical path per module (e.g. "sign in → create an expense → see it listed"), not every edge case — edge cases belong in unit tests.

## What to prioritize
Most business-rule edge cases (validation, calculations, permissions) should be covered at the `service.ts` unit-test level, since that's the cheapest and fastest layer to test and matches where business logic actually lives (see `be-dev` skill). Don't push edge-case coverage down to Playwright e2e tests — that's slow and expensive for logic that has nothing to do with the UI.

## When a feature is "done"
Per APPROACH.md §12 (Feature Validation Workflow), a feature isn't done until its relevant unit + integration tests pass — this is step 1 of 3, before the code-review pass and the real run-through. See the `feature-validator` agent, which runs all three.

## Reference files
- `references/unit-testing.md` — Vitest patterns for `service.ts`, mocking the DB client vs. using a real test database.
- `references/integration-testing.md` — Supertest patterns, test database setup/teardown, testing auth-gated routes.
- `references/e2e-testing.md` — Playwright setup, picking critical paths, avoiding flaky selectors.
