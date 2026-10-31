-- Notes module (APPROACH.md §18) — a note is just a title + rich-text
-- content, no generic items/categories model needed (unlike Progress
-- Tracker §10 or Portfolio §9). One table.

CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '', -- sanitized HTML (service.ts), rendered via dangerouslySetInnerHTML
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
