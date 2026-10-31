-- Portfolio module (APPROACH.md §9) — private "career kit": copyable
-- links/documents/contact info for job applications. Generic sections +
-- items model, same philosophy as Progress Tracker (§10): no fixed
-- section list, no table-per-item-kind, so adding a new section or a new
-- kind of item never needs a migration.

CREATE TABLE IF NOT EXISTS portfolio_sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_sections_user_id ON portfolio_sections(user_id);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES portfolio_sections(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'link', -- 'link' | 'document' | 'text'
  label      TEXT NOT NULL,
  value      TEXT, -- URL (link/document) or plain text (text)
  note       TEXT, -- optional secondary line: doc size/date, stack tags, etc.
  pinned     BOOLEAN NOT NULL DEFAULT false,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_user_id ON portfolio_items(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_section_id ON portfolio_items(section_id);
