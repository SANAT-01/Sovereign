-- Shared users table (APPROACH.md §7) — the root of per-user data isolation.
-- Not a feature module; just the identity root every other module's tables
-- reference via user_id. Keyed by Google OAuth sub/email.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub   TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
