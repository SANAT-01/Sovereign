import { db } from '../../db/client.js';

export type ResumeJobStatus = 'running' | 'done' | 'failed';
export type ResumeJobKind = 'tex' | 'pdf';

export interface ResumeJob {
  id: string;
  user_id: string;
  external_job_id: string;
  status: ResumeJobStatus;
  kind: ResumeJobKind;
  layout: string | null;
  job_title: string;
  company: string;
  source_file_name: string;
  compile_attempts: number | null;
  folder_id: string | null;
  folder_url: string | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

export async function createJob(input: {
  userId: string;
  externalJobId: string;
  kind: ResumeJobKind;
  jobTitle: string;
  company: string;
  sourceFileName: string;
  folderId: string;
  folderUrl: string;
}): Promise<ResumeJob> {
  const result = await db.query<ResumeJob>(
    `INSERT INTO resume_jobs
       (user_id, external_job_id, kind, job_title, company, source_file_name,
        folder_id, folder_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [input.userId, input.externalJobId, input.kind, input.jobTitle, input.company,
     input.sourceFileName, input.folderId, input.folderUrl],
  );
  return result.rows[0];
}

// Scoped by user_id as well as id, so one user's job id can never address
// another user's row — the same per-user isolation every other module's
// repository applies (APPROACH.md §7).
export async function findJob(userId: string, id: string): Promise<ResumeJob | null> {
  const result = await db.query<ResumeJob>(
    'SELECT * FROM resume_jobs WHERE user_id = $1 AND id = $2',
    [userId, id],
  );
  return result.rows[0] ?? null;
}

export async function listJobs(userId: string, limit: number): Promise<ResumeJob[]> {
  const result = await db.query<ResumeJob>(
    'SELECT * FROM resume_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit],
  );
  return result.rows;
}

export async function markDone(id: string): Promise<ResumeJob> {
  const result = await db.query<ResumeJob>(
    `UPDATE resume_jobs SET status = 'done', finished_at = now()
     WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0];
}

export async function markFailed(id: string, error: string): Promise<ResumeJob> {
  const result = await db.query<ResumeJob>(
    `UPDATE resume_jobs SET status = 'failed', error = $2, finished_at = now()
     WHERE id = $1 RETURNING *`,
    [id, error.slice(0, 4000)],
  );
  return result.rows[0];
}

// The Drive folder is deliberately NOT deleted with the row: it is the user's
// own output, and losing a tailored resume because a list item was tidied away
// would be the wrong trade.
export async function deleteJob(userId: string, id: string): Promise<ResumeJob | null> {
  const result = await db.query<ResumeJob>(
    'DELETE FROM resume_jobs WHERE user_id = $1 AND id = $2 RETURNING *',
    [userId, id],
  );
  return result.rows[0] ?? null;
}

// --- base resume profile ---------------------------------------------------

export interface ResumeProfileRow {
  user_id: string;
  kind: ResumeJobKind;
  file_name: string;
  object_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
  updated_at: Date;
}

export async function findProfile(userId: string): Promise<ResumeProfileRow | null> {
  const result = await db.query<ResumeProfileRow>(
    'SELECT * FROM resume_profiles WHERE user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
}

// Replacing a base resume is an upsert, not a second row: user_id is the
// primary key.
export async function upsertProfile(input: {
  userId: string;
  kind: ResumeJobKind;
  fileName: string;
  objectName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ResumeProfileRow> {
  const result = await db.query<ResumeProfileRow>(
    `INSERT INTO resume_profiles (user_id, kind, file_name, object_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       kind = EXCLUDED.kind,
       file_name = EXCLUDED.file_name,
       object_name = EXCLUDED.object_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       updated_at = now()
     RETURNING *`,
    [input.userId, input.kind, input.fileName, input.objectName, input.mimeType, input.sizeBytes],
  );
  return result.rows[0];
}

export async function deleteProfile(userId: string): Promise<ResumeProfileRow | null> {
  const result = await db.query<ResumeProfileRow>(
    'DELETE FROM resume_profiles WHERE user_id = $1 RETURNING *',
    [userId],
  );
  return result.rows[0] ?? null;
}
