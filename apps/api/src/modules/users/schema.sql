-- Shared users table (APPROACH.md §7) — the root of per-user data isolation.
-- Not a feature module; just the identity root every other module's tables
-- reference via user_id. Keyed by Google OAuth sub/email.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub   TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_urls  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added for the profile/avatar-upload feature (APPROACH.md §8). IF NOT
-- EXISTS keeps this idempotent on repeated migration runs, same as the
-- CREATE TABLE above.
--
-- avatar_urls is a JSONB map of size variant -> public URL, e.g.
-- {"thumbnail": "...", "small": "...", "medium": "...", "large": "..."}
-- — one upload generates all variants (profile/service.ts); callers pick
-- the variant that matches where it's displayed instead of one fixed size
-- everywhere. Replaces the earlier single-URL avatar_url column.
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_urls JSONB;

-- Which module summaries show on the home screen (user-configurable —
-- "there can be many different applications," so home is a curated
-- summary, not a fixed dashboard). JSONB array of module keys. Defaults
-- to just "progress" (the only module with a real summary right now) so
-- a fresh account still sees something useful without finding a toggle first.
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_widgets JSONB NOT NULL DEFAULT '["progress"]'::jsonb;
