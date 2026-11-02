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
-- summary, not a fixed dashboard). JSONB array of module keys. Now that
-- every module has a real summary (expenses/notes/portfolio joined
-- progress), defaults to all four so a fresh account sees the full
-- overview without finding the toggle first.
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_widgets JSONB NOT NULL DEFAULT '["progress", "expenses", "notes", "portfolio"]'::jsonb;

-- One-time backfill: accounts created before expenses/notes/portfolio had
-- summaries are still sitting on the old progress-only default. Only
-- touches rows that exactly match that old default (never a row the user
-- has actually customized via the toggle), so it's safe to leave this
-- idempotent statement in place permanently rather than a one-off script.
UPDATE users SET home_widgets = '["progress", "expenses", "notes", "portfolio"]'::jsonb
  WHERE home_widgets = '["progress"]'::jsonb;

-- Which chart type (bar/line/pie) each progress summary chart renders as
-- (progress/service.ts's CHART_METRICS) — a map of metric key -> chart
-- type, user-customizable from the UI, persisted so it's remembered
-- across visits/devices rather than resetting every page load.
ALTER TABLE users ADD COLUMN IF NOT EXISTS progress_chart_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Per-user LLM API key support, superseded by a single server-wide
-- freellmapi endpoint (APPROACH.md §19) — no per-user secret to store
-- anymore.
ALTER TABLE users DROP COLUMN IF EXISTS gemini_api_key_encrypted;

-- Email reminder preferences (APPROACH.md §21) — enabled/off, how often to
-- check (minutes), and when the last digest actually went out. The 3-hour
-- production floor on intervalMinutes is enforced in code (jobs/reminders.ts),
-- not here, so dev/test can still use short intervals freely.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
  DEFAULT '{"enabled": false, "intervalMinutes": 1440, "lastSentAt": null}'::jsonb;
