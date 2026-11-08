-- Resume module — tailors a resume to one job description. The generation
-- itself runs in n8n (LLM rewrite, LaTeX compile, cover letter); this table
-- is the app's own record of each request so a result survives a page
-- reload, and so the n8n/Drive round trip is paid once rather than on
-- every poll.
--
-- The artifacts are split by size and sensitivity: the PDF goes to MinIO
-- (APPROACH.md §8) as a PRIVATE object served via presigned URL, since a
-- resume is personal data and must not be public-read like an avatar. The
-- .tex and cover letter are text and small, so they live in the row.

CREATE TABLE IF NOT EXISTS resume_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The id n8n assigned. Also the name of its Drive folder, and the only
  -- credential for reading that result back, so it is never exposed to the
  -- browser: the frontend addresses a job by this table's own `id`.
  external_job_id  TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'running', -- running | done | failed
  -- 'tex' = the applicant's own LaTeX was rewritten in place.
  -- 'pdf' = text was extracted and poured into the house template.
  kind             TEXT NOT NULL,
  layout           TEXT,                            -- applicant-template | house-template
  job_title        TEXT NOT NULL DEFAULT '',
  company          TEXT NOT NULL DEFAULT '',
  source_file_name TEXT NOT NULL DEFAULT '',
  compile_attempts INTEGER,
  pdf_object       TEXT,                            -- MinIO object name, not a URL: presigned URLs expire
  pdf_bytes        INTEGER,
  resume_tex       TEXT,
  cover_letter     TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_resume_jobs_user_id ON resume_jobs(user_id, created_at DESC);

-- The user's base resume, stored once and reused for every job. One row per
-- user: `user_id` IS the primary key, which is what enforces that without a
-- flag or a trigger. Replacing it is an upsert.
--
-- Only metadata lives here. The file itself is a private MinIO object
-- (APPROACH.md §8), same as a generated PDF — a resume is personal data and
-- must not be public-read like an avatar.
CREATE TABLE IF NOT EXISTS resume_profiles (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,              -- 'tex' | 'pdf'
  file_name   TEXT NOT NULL,              -- as uploaded, for display only
  object_name TEXT NOT NULL,              -- MinIO key; never leaves the API
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The result is now a Google Drive folder rather than files carried back
-- through the API, so the row records where that folder is and nothing else.
-- Written as idempotent ALTERs because the migrate runner replays this whole
-- file on every run.
ALTER TABLE resume_jobs ADD COLUMN IF NOT EXISTS folder_id  TEXT;
ALTER TABLE resume_jobs ADD COLUMN IF NOT EXISTS folder_url TEXT;

-- Dropped with the base64 return path: the PDF is no longer decoded, stored in
-- MinIO or served through a presigned URL, and the .tex and cover letter live
-- in the Drive folder instead of in this row.
ALTER TABLE resume_jobs DROP COLUMN IF EXISTS pdf_object;
ALTER TABLE resume_jobs DROP COLUMN IF EXISTS pdf_bytes;
ALTER TABLE resume_jobs DROP COLUMN IF EXISTS resume_tex;
ALTER TABLE resume_jobs DROP COLUMN IF EXISTS cover_letter;
