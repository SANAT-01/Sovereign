import { ValidationError, NotFoundError } from '../../errors.js';
import { uploadPrivateFile, removeFile, getFile } from '../../lib/storage.js';
import * as repository from './repository.js';
import type { ResumeJob, ResumeJobKind } from './repository.js';

// Generation runs in n8n: LLM rewrite -> LaTeX compile (with up to 3 fix
// retries) -> cover letter. That takes one to three minutes, far longer than
// any sane HTTP timeout, so the contract is submit-then-poll and this service
// owns both halves.
//
// Lazily read on first use, not at import time, so the API still boots in a
// deployment that has not configured this module yet — same pattern as
// lib/mailer.ts, lib/kafka.ts and the assistant's getConfig().
function getConfig(): { submitUrl: string; statusUrlBase: string; apiKey: string } {
  const submitUrl = process.env.N8N_RESUME_SUBMIT_URL;
  const statusUrlBase = process.env.N8N_RESUME_STATUS_URL;
  const apiKey = process.env.N8N_RESUME_API_KEY;
  if (!submitUrl || !statusUrlBase || !apiKey) {
    throw new Error(
      'N8N_RESUME_SUBMIT_URL, N8N_RESUME_STATUS_URL and N8N_RESUME_API_KEY must be set to use the resume module',
    );
  }
  return { submitUrl, statusUrlBase: statusUrlBase.replace(/\/+$/, ''), apiKey };
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_JD_CHARS = 20_000;
const SUBMIT_TIMEOUT_MS = 30_000;
const STATUS_TIMEOUT_MS = 60_000;   // the done response carries the PDF inline
const LIST_LIMIT = 50;

// Accepted inputs, and why each is decided by extension AND mime type:
// browsers send application/octet-stream for a .tex often enough that mime
// alone rejects valid uploads, and a mime header alone is trivially wrong.
const TEX_MIMES = ['application/x-tex', 'text/x-tex', 'text/plain', 'application/octet-stream'];

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function classifyUpload(file: { originalname: string; mimetype: string }): ResumeJobKind {
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.tex')) {
    if (!TEX_MIMES.includes(file.mimetype)) {
      throw new ValidationError(`unexpected content type for a .tex file: ${file.mimetype}`);
    }
    return 'tex';
  }
  if (name.endsWith('.pdf')) {
    if (file.mimetype !== 'application/pdf') {
      throw new ValidationError(`unexpected content type for a .pdf file: ${file.mimetype}`);
    }
    return 'pdf';
  }
  throw new ValidationError('resume must be a .tex or .pdf file');
}

async function postJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
    if (!res.ok) {
      // n8n reports a failed execution as {message, hint}, naming the node that
      // threw. Reading only `error` turned every workflow bug into a bare
      // "HTTP 500" with the cause discarded, so all three shapes are surfaced
      // and `raw` covers a non-JSON body (a proxy's HTML error page).
      const detail = (body as {
        error?: string; details?: string[]; message?: string; hint?: string; raw?: string;
      } | null);
      const reason = detail?.error ?? detail?.message ?? detail?.raw;
      const err = new Error(
        `generator returned HTTP ${res.status}` +
        (reason ? `: ${reason}` : '') +
        (detail?.hint ? ` (hint: ${detail.hint})` : '') +
        (detail?.details?.length ? ` (${detail.details.join('; ')})` : ''),
      ) as Error & { httpStatus?: number };
      // Carried so getJob can tell a misconfiguration apart from a blip.
      err.httpStatus = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export interface SubmitInput {
  jd: string;
  title?: string;
  company?: string;
  skills?: string;
  // A one-off upload can become the stored base in the same request, so the
  // second job needs no file at all.
  saveAsBase?: boolean;
}

// What the generator needs, whichever way the bytes arrived.
interface ResumeSource {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  kind: ResumeJobKind;
}

// A job may supply a .tex, a PDF, or both. At least one is required; with
// neither slot filled it falls back to the resume saved against the account.
//
// When both are present the .tex is what gets tailored, because it is the only
// input that carries a layout. The PDF rides along untouched and n8n stores it
// in the job folder as a reference copy.
async function resolveSources(
  userId: string,
  files: { tex?: UploadedFile; pdf?: UploadedFile },
): Promise<{ tex?: ResumeSource; pdf?: ResumeSource }> {
  const check = (f: UploadedFile, label: string): ResumeSource => {
    if (f.size > MAX_UPLOAD_BYTES) {
      throw new ValidationError(`${label} file is ${f.size} bytes, limit is ${MAX_UPLOAD_BYTES}`);
    }
    const kind = classifyUpload(f);
    if (kind !== label) {
      throw new ValidationError(`the ${label} slot was given a .${kind} file`);
    }
    return { ...f, kind };
  };

  const tex = files.tex ? check(files.tex, 'tex') : undefined;
  const pdf = files.pdf ? check(files.pdf, 'pdf') : undefined;
  if (tex || pdf) return { tex, pdf };

  const profile = await repository.findProfile(userId);
  if (!profile) {
    throw new ValidationError('attach a .tex or a PDF, or save a base resume first');
  }

  let buffer: Buffer;
  try {
    buffer = await getFile(profile.object_name);
  } catch {
    // The row survived but the object did not. Saying so beats a generic
    // storage error, because the fix is to re-upload.
    throw new ValidationError('your saved resume could not be read from storage; upload it again');
  }

  const restored: ResumeSource = {
    originalname: profile.file_name,
    mimetype: profile.mime_type,
    size: buffer.length,
    buffer,
    kind: profile.kind,
  };
  return profile.kind === 'tex' ? { tex: restored } : { pdf: restored };
}

export async function submitJob(
  userId: string,
  files: { tex?: UploadedFile; pdf?: UploadedFile },
  input: SubmitInput,
): Promise<PublicResumeJob> {
  const jd = input.jd.trim();
  if (!jd) throw new ValidationError('jd (the job description) is required');
  if (jd.length > MAX_JD_CHARS) {
    throw new ValidationError(`jd is ${jd.length} characters, limit is ${MAX_JD_CHARS}`);
  }

  // Resolved before the generator is called, so a missing resume fails here
  // rather than after a job has been accepted.
  const sources = await resolveSources(userId, files);
  const primary = sources.tex ?? sources.pdf!;

  // Saving the base happens BEFORE submitting: if the generator is down, the
  // user should still not have to re-pick the file next time. The .tex is
  // preferred as the thing worth keeping.
  const uploaded = files.tex ?? files.pdf;
  if (uploaded && input.saveAsBase) await saveProfile(userId, uploaded);

  const cfg = getConfig();

  const form = new FormData();
  // Two named parts, matching the two slots n8n's Intake looks for. Only the
  // ones actually supplied are sent.
  if (sources.tex) {
    form.append('tex', new Blob([sources.tex.buffer], { type: sources.tex.mimetype }),
                sources.tex.originalname);
  }
  if (sources.pdf) {
    form.append('pdf', new Blob([sources.pdf.buffer], { type: sources.pdf.mimetype }),
                sources.pdf.originalname);
  }
  form.append('jd', jd);
  if (input.title) form.append('title', input.title);
  if (input.company) form.append('company', input.company);
  if (input.skills) form.append('skills', input.skills);

  const accepted = await postJson(
    cfg.submitUrl,
    { method: 'POST', headers: { 'x-api-key': cfg.apiKey }, body: form },
    SUBMIT_TIMEOUT_MS,
  ) as { jobId?: string; folderId?: string; folderUrl?: string } | null;

  if (!accepted?.jobId) throw new Error('generator accepted the request but returned no jobId');
  // The folder is created before generation starts, so its link comes back in
  // the same response. Without it there is nothing to show the user and
  // nothing to poll, so it is required rather than optional.
  if (!accepted.folderId) throw new Error('generator returned no Drive folder id');

  const row = await repository.createJob({
    userId,
    externalJobId: accepted.jobId,
    kind: primary.kind,
    jobTitle: input.title?.trim() ?? '',
    company: input.company?.trim() ?? '',
    sourceFileName: primary.originalname,
    folderId: accepted.folderId,
    folderUrl: accepted.folderUrl
      ?? `https://drive.google.com/drive/folders/${accepted.folderId}`,
  });
  return toPublic(row);
}

interface GeneratorStatus {
  status?: string;
  folderUrl?: string;
  files?: string[];
  error?: string;
}

// Polled by the frontend. n8n is only contacted while the row is still
// running: once a job reaches a terminal state there is nothing left to learn,
// so reloading a finished job costs one SELECT.
//
// Nothing is transferred on completion any more. The artifacts live in the
// Drive folder whose link was handed back at submit time, so "done" is just a
// status change.
export async function getJob(userId: string, id: string): Promise<PublicResumeJob> {
  const row = await repository.findJob(userId, id);
  if (!row) throw new NotFoundError('resume job not found');
  if (row.status !== 'running') return toPublic(row);
  if (!row.folder_id) {
    return toPublic(await repository.markFailed(row.id, 'no Drive folder was recorded for this job'));
  }

  const cfg = getConfig();
  let body: GeneratorStatus | null;
  try {
    body = await postJson(
      `${cfg.statusUrlBase}/${encodeURIComponent(row.folder_id)}`,
      { method: 'GET', headers: { 'x-api-key': cfg.apiKey } },
      STATUS_TIMEOUT_MS,
    ) as GeneratorStatus | null;
  } catch (err) {
    // A generator that is unreachable right now is not a failed job: the work
    // may well still be running. Report it as still running and let the next
    // poll settle it, rather than burning the row on a transient error.
    //
    // 404 and 403 are the exceptions. They mean the status webhook is not
    // registered (the workflow is inactive) or the key is wrong -- neither
    // heals by waiting, so polling on would just spin until the client's
    // timeout with no explanation. Fail now, with the reason.
    const status = (err as { httpStatus?: number }).httpStatus;
    if (status === 404 || status === 403) {
      return toPublic(await repository.markFailed(
        row.id,
        `the generator could not be reached, so this job's outcome is unknown: ${(err as Error).message}`,
      ));
    }
    return toPublic(row, (err as Error).message);
  }

  if (body?.status === 'failed') {
    return toPublic(await repository.markFailed(row.id, body.error || 'generation failed'));
  }
  if (body?.status === 'done') return toPublic(await repository.markDone(row.id));
  return toPublic(row);
}

export async function listJobs(userId: string): Promise<PublicResumeJobSummary[]> {
  const rows = await repository.listJobs(userId, LIST_LIMIT);
  return rows.map(toSummary);
}

// Removes this app's record of the job. The Drive folder is left alone on
// purpose: it holds the user's actual output, and deleting a tailored resume
// because a list entry was tidied away would be the wrong trade.
export async function deleteJob(userId: string, id: string): Promise<void> {
  const row = await repository.deleteJob(userId, id);
  if (!row) throw new NotFoundError('resume job not found');
}

export interface PublicResumeJobSummary {
  id: string;
  status: repository.ResumeJobStatus;
  kind: ResumeJobKind;
  layout: string | null;
  jobTitle: string;
  company: string;
  sourceFileName: string;
  folderUrl: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface PublicResumeJob extends PublicResumeJobSummary {
  compileAttempts: number | null;
  // Known from the moment the job is accepted, not only on completion: the
  // folder is created before any generation happens.
  folderUrl: string | null;
  error: string | null;
  // Set when the generator could not be reached on this poll. The job is
  // still running; this is for showing "retrying" rather than silence.
  pollWarning?: string;
}

function toSummary(row: ResumeJob): PublicResumeJobSummary {
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    layout: row.layout,
    jobTitle: row.job_title,
    company: row.company,
    sourceFileName: row.source_file_name,
    folderUrl: row.folder_url,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

// external_job_id and folder_id are deliberately absent: each is a read
// credential for the generator's own result, so neither leaves the API. The
// folder URL is safe to hand over - it only opens for the Drive owner.
function toPublic(row: ResumeJob, pollWarning?: string): PublicResumeJob {
  return {
    ...toSummary(row),
    compileAttempts: row.compile_attempts,
    folderUrl: row.folder_url,
    error: row.error,
    ...(pollWarning ? { pollWarning } : {}),
  };
}

// --- the base resume -------------------------------------------------------

export interface PublicResumeProfile {
  kind: ResumeJobKind;
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

// object_name is deliberately absent: it is a storage key, and nothing outside
// this module needs it.
function toPublicProfile(row: repository.ResumeProfileRow): PublicResumeProfile {
  return {
    kind: row.kind,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfile(userId: string): Promise<PublicResumeProfile | null> {
  const row = await repository.findProfile(userId);
  return row ? toPublicProfile(row) : null;
}

export async function saveProfile(userId: string, file: UploadedFile): Promise<PublicResumeProfile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(`resume is ${file.size} bytes, limit is ${MAX_UPLOAD_BYTES}`);
  }
  const kind = classifyUpload(file);

  // The extension is part of the key so the stored content type stays honest,
  // which means replacing a .tex with a .pdf writes a DIFFERENT object. The
  // old one has to go or it is orphaned beside the new one forever.
  const previous = await repository.findProfile(userId);
  const objectName = `resumes/${userId}/base.${kind}`;

  await uploadPrivateFile(objectName, file.buffer, file.mimetype);

  const row = await repository.upsertProfile({
    userId,
    kind,
    fileName: file.originalname,
    objectName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });

  if (previous && previous.object_name !== objectName) {
    try { await removeFile(previous.object_name); } catch { /* orphaned object only */ }
  }

  return toPublicProfile(row);
}

export async function deleteProfile(userId: string): Promise<void> {
  const row = await repository.deleteProfile(userId);
  if (!row) throw new NotFoundError('no base resume saved');
  // The row is already gone; a storage failure would only orphan a file, and
  // is not worth failing the request the user asked for.
  try { await removeFile(row.object_name); } catch { /* orphaned object only */ }
}
