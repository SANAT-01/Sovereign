# Schema Conventions

## Table naming
`<module>_<entity>`, plural entity names: `expenses_transactions`, `expenses_categories`, `notes_entries`, `notes_tags`, `notes_entry_tags` (join table).

## Standard columns — every table
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
```
Use UUIDs, not serial integers — avoids leaking record counts/ordering to clients, and avoids collisions if data is ever merged across environments.

## The shared `users` table
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Every user-owned table references this via `user_id`:
```sql
CREATE TABLE expenses_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL,
  category    TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_transactions_user_id ON expenses_transactions(user_id);
```
`ON DELETE CASCADE` matches this project's model (no multi-tenant org structure — a deleted user's data goes with them). Revisit only if you add a "soft delete the account, keep data for N days" requirement later.

## Money columns
Use `NUMERIC(12, 2)`, never `FLOAT`/`REAL` — floating point drift on money values is a real bug class, not a theoretical one.

## Indexing rule of thumb
Index every foreign key column (`user_id` at minimum) and any column you'll filter or sort by in a listing query (e.g. `created_at` for "recent expenses"). Don't index columns you aren't querying on — unnecessary write overhead.

## Soft delete vs. hard delete
Default to hard delete (just `DELETE`) unless a module has a specific "undo"/trash requirement. Add a `deleted_at TIMESTAMPTZ` column only when that requirement is real — don't add it speculatively to every table.

## Enums
Prefer a `TEXT` column with an application-level (Zod) enum check over a Postgres `ENUM` type, unless the set of values is genuinely fixed forever (e.g. a currency code list) — Postgres enums are painful to modify later (`ALTER TYPE ... ADD VALUE` has restrictions), while a `TEXT` + check constraint or app-level validation is trivial to extend.
