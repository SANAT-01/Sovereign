# Migrations (Drizzle)

## Workflow
1. Define/modify the table shape in the module's Drizzle schema file (e.g. `/apps/api/src/modules/expenses/schema.ts`).
2. Generate a migration: `drizzle-kit generate` — produces a timestamped SQL file, don't hand-write the migration SQL from scratch if the tool can generate it.
3. Review the generated SQL before applying it — Drizzle's diffing can occasionally choose a destructive path (e.g. drop-and-recreate a column) where a manual `ALTER COLUMN` would be safer. Edit the generated file if needed.
4. Apply: `drizzle-kit migrate` (or your chosen runner) against the target database.
5. Commit the migration file alongside the code that depends on it, in the same change — a schema change and the code using it should never land in separate commits/deploys.

## Rules
- Never edit a migration file that's already been applied to any environment (including your own dev DB) — write a new migration instead. Editing history breaks the guarantee that "replaying migrations in order reproduces the schema."
- Every migration should be runnable against an empty database from scratch — this is what lets you rebuild the dev DB or spin up a fresh environment reliably.
- Additive changes (new table, new nullable column) are low-risk and can ship anytime. Destructive changes (dropping a column, renaming a table, adding a `NOT NULL` to an existing populated column) need a backfill plan — don't ship a migration that would fail or silently lose data against real rows.

## Backfilling a new NOT NULL column
Three-step pattern, as separate migrations if there's real data to protect:
1. Add the column as nullable, with a default if applicable.
2. Backfill existing rows (a one-off script or `UPDATE` statement).
3. A follow-up migration adds the `NOT NULL` constraint once you've confirmed no nulls remain.

For this project's current scale (personal use, low data volume), steps 1-3 can often collapse into one migration — but keep the pattern in mind once there's real user data you can't just regenerate.

## Rolling back
Prefer writing a new forward migration that undoes the change over reaching for `drizzle-kit`'s down-migration tooling in production — "down" migrations are easy to get wrong and rarely tested. For local dev, resetting the DB and replaying migrations from scratch is simpler and safer than rolling back.
