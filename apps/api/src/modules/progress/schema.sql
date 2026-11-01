-- Progress Tracker module (APPROACH.md §10) — a generic items model, not
-- one table per tracked-item type, so adding a new type later needs no
-- migration: just a new `type` string and application logic for its
-- `data` shape and widget.

DROP TABLE IF EXISTS progress_habits CASCADE;
DROP TABLE IF EXISTS progress_habit_logs CASCADE;
DROP TABLE IF EXISTS progress_goals CASCADE;
DROP TABLE IF EXISTS progress_goal_topics CASCADE;
DROP TABLE IF EXISTS progress_events CASCADE;
DROP TABLE IF EXISTS progress_pipeline_items CASCADE;
DROP TABLE IF EXISTS progress_plans CASCADE;

CREATE TABLE IF NOT EXISTS progress_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL, -- 'daily' | 'study_plan' | 'interview' | 'other' | (future types)
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active', -- active | done | cancelled (meaning layered per type in service.ts)
  due_at           TIMESTAMPTZ, -- "the date that matters" for this item (interview date, plan due date); null if not applicable
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- generic staleness signal, updated whenever the item is meaningfully touched
  data             JSONB NOT NULL DEFAULT '{}'::jsonb, -- type-specific payload — see APPROACH.md §10's table
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_progress_items_user_id ON progress_items(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_items_user_type ON progress_items(user_id, type);

-- Generic across every type, same philosophy as `status`/`due_at` — one
-- column rather than a type-specific `data` key, so sorting/filtering by
-- priority works the same for every item regardless of category.
ALTER TABLE progress_items ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'; -- low | medium | high

-- Generic per-day completion log — usable by any type that wants a streak
-- (today just `daily`, but keyed off item_id generically, not a
-- habit-specific foreign key).
CREATE TABLE IF NOT EXISTS progress_item_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES progress_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_progress_item_logs_item_id ON progress_item_logs(item_id);
