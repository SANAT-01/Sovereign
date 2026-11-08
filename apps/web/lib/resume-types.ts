// Mirrors apps/api/src/modules/resume. The generator's own job id is
// deliberately absent: it is the read credential for the result and never
// leaves Express (APPROACH.md §6).

export type ResumeJobStatus = "running" | "done" | "failed";
export type ResumeJobKind = "tex" | "pdf";

export interface ResumeJobSummary {
  id: string;
  status: ResumeJobStatus;
  // Which input drove generation. 'tex' keeps the applicant's own layout;
  // 'pdf' means the text was rebuilt in the house template.
  kind: ResumeJobKind;
  layout: string | null;
  jobTitle: string;
  company: string;
  sourceFileName: string;
  // Live from the moment the job is accepted: the Drive folder is created
  // before any generation happens.
  folderUrl: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ResumeJob extends ResumeJobSummary {
  compileAttempts: number | null;
  error: string | null;
  // The generator was unreachable on this poll; the job is still running.
  pollWarning?: string;
}

export interface ResumeJobsResponse {
  jobs: ResumeJobSummary[];
}

// The resume saved against the account, reused for every job so the file only
// has to be chosen once. Metadata only: the bytes and the storage key stay in
// Express.
export interface ResumeProfile {
  kind: ResumeJobKind;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}
