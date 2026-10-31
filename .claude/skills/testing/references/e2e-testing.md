# End-to-End Testing (Playwright)

## Scope — critical paths only
One or two Playwright tests per module, covering the path a real daily use actually exercises:
- Expenses: "log in → create an expense → see it in the list → edit it → see the update."
- Notes: "log in → create a note → see it saved → search/filter for it."

Don't write Playwright tests for every validation edge case — those are already covered faster and more reliably at the unit-test level (`unit-testing.md`). E2e tests exist to catch integration/wiring problems (a broken SSR/CSR path, a UI that doesn't actually call the right endpoint) that unit and integration tests can't see.

## Checking both SSR and CSR paths
Per APPROACH.md §6, a module may have both an SSR path (initial page load) and a CSR path (client-side interactions after load, via the proxy route). A good e2e test exercises both naturally just by driving the UI: initial navigation hits SSR, subsequent in-page actions (e.g. submitting a form without a full reload) hit CSR. If a feature has a CSR-only interaction (e.g. a live search-as-you-type), make sure the e2e test actually triggers it rather than only checking the initial server-rendered state.

## Avoiding flaky selectors
Prefer `data-testid` or accessible roles/labels over CSS classes or DOM structure, which change as the UI evolves:
```ts
await page.getByTestId('create-expense-button').click();
await page.getByLabel('Amount').fill('42');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Expense added')).toBeVisible();
```

## Auth in e2e tests
Driving the real Google OAuth consent screen in automated e2e tests is fragile and slow. Instead, seed a logged-in session directly (e.g. set the session cookie via Playwright's `context.addCookies()` using a test-helper-generated session) and start the test already authenticated, reserving the actual OAuth click-through for manual verification (see the `feature-validator` agent's "real run-through" step).

## Test database
Point the e2e run at the same test database used for integration tests, reset between runs — don't run e2e tests against production or a shared dev database where leftover state causes flaky failures.
