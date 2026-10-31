---
name: data-modeling
description: Design or modify the PostgreSQL schema for this project. Use when adding tables, writing migrations, or changing a module's data model.
---

# Data Modeling (PostgreSQL)

Rules from APPROACH.md §7 — follow these for every schema change.

## Tooling
PostgreSQL, self-hosted on the VPS. Drizzle (or node-pg-migrate) for versioned migrations — no hand-run ad hoc SQL against the live DB.

## Conventions
- One database, one schema. Tables are namespaced per module: `<module>_<entity>`, e.g. `expenses_transactions`, `expenses_categories`, `notes_entries`, `notes_tags`.
- A shared `users` table, keyed by Google OAuth `sub`/email, is the root of per-user data isolation. Every module's user-owned tables carry a `user_id` foreign key referencing it.
- Each module owns a `schema.sql` migration file under its own folder (`/apps/api/src/modules/<module>/schema.sql`) — don't put unrelated modules' tables in the same migration.
- A module's tables are touched only by that module's `repository.ts` (see `be-dev` skill) — this is a data-access rule, not just a schema convention, and it's what keeps modules extractable later.

## Before writing a migration
1. Sketch the ERD/table shape for the feature.
2. Check it against APPROACH.md §14 (document before implementing) — if this is a new module or a structural change, it should be reflected in APPROACH.md first.
3. Write the migration, run it, confirm it's idempotent/reversible where practical.

## Portfolio module exception
May not need any database tables at all if it's static/content-driven — don't force a schema where the module doesn't need one (APPROACH.md §8).

## Reference files — read before non-trivial schema work
- `references/schema-conventions.md` — column types, naming, indexing, foreign keys, soft-delete vs. hard-delete.
- `references/migrations.md` — Drizzle workflow: writing, running, and rolling back migrations safely.
- `references/query-patterns.md` — avoiding N+1 queries, pagination, transactions, and where these concerns live (`repository.ts` vs `service.ts`).
