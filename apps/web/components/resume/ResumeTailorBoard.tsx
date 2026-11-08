"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { OpenIcon, UploadIcon, TrashIcon, CloseIcon } from "../ui/icons";
import type { ResumeJob, ResumeJobSummary, ResumeProfile } from "@/lib/resume-types";

/**
 * CSR per APPROACH.md §6: every call goes to the same-origin /api/resume/*,
 * which next.config.js's blanket /api/:path* rewrite forwards to the internal
 * Express API. The browser never sees the generator's URL or key.
 *
 * Generation takes one to three minutes, so the contract is submit-then-poll.
 * The Drive folder is created before generation starts, which is why its link
 * is shown from the moment a job is accepted rather than only on success.
 */

const POLL_MS = 6000;
// Generous but finite. A job that has not finished by now is almost certainly
// stuck, and an unbounded poll would hammer the API for the rest of the session.
const POLL_TIMEOUT_MS = 8 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;

type Slot = "tex" | "pdf";

const SLOTS: { slot: Slot; label: string; accept: string; hint: string }[] = [
  {
    slot: "tex",
    label: "LaTeX source",
    // Extensions only: application/x-tex and text/x-tex are not registered
    // media types, and mixing unresolvable MIME entries with extensions makes
    // some file dialogs grey one of the two out.
    accept: ".tex",
    hint: "Keeps your own layout. Preferred.",
  },
  {
    slot: "pdf",
    label: "PDF",
    accept: ".pdf",
    hint: "Used when there is no .tex. Alongside one, it is just stored.",
  },
];

function formatSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusLabel(job: ResumeJobSummary): string {
  if (job.status === "running") return "Generating";
  if (job.status === "failed") return "Failed";
  return "Done";
}

export function ResumeTailorBoard({
  initialJobs,
  initialProfile,
}: {
  initialJobs: ResumeJobSummary[];
  initialProfile: ResumeProfile | null;
}) {
  const [jobs, setJobs] = useState<ResumeJobSummary[]>(initialJobs);
  const [profile, setProfile] = useState<ResumeProfile | null>(initialProfile);
  const [active, setActive] = useState<ResumeJob | null>(null);
  const [files, setFiles] = useState<{ tex?: File; pdf?: File }>({});
  const [jd, setJd] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsBase, setSaveAsBase] = useState(true);

  const texRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const slotRef: Record<Slot, React.RefObject<HTMLInputElement | null>> = {
    tex: texRef,
    pdf: pdfRef,
  };

  // One timer, cleared on unmount, so navigating away mid-generation does not
  // leave a poll running against a component that no longer exists.
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const hasUpload = Boolean(files.tex || files.pdf);
  const canSubmit = (hasUpload || Boolean(profile)) && jd.trim().length > 0 && !busy;

  // The accept attribute is only a hint; this is the real check.
  function validate(f: File, slot: Slot): string | null {
    if (!f.name.toLowerCase().endsWith(`.${slot}`)) {
      return `The ${slot === "tex" ? "LaTeX" : "PDF"} slot needs a .${slot} file.`;
    }
    if (f.size > MAX_BYTES) {
      return `That file is ${(f.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.`;
    }
    return null;
  }

  function pick(slot: Slot) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = ""; // so re-picking the same file fires onChange again
      if (!f) return;
      const bad = validate(f, slot);
      if (bad) { setError(bad); return; }
      setError(null);
      setFiles((prev) => ({ ...prev, [slot]: f }));
    };
  }

  function clearSlot(slot: Slot) {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  async function saveProfileFile(f: File) {
    const slot: Slot = f.name.toLowerCase().endsWith(".tex") ? "tex" : "pdf";
    const bad = validate(f, slot);
    if (bad) { setError(bad); return; }
    setError(null);
    setSavingProfile(true);
    const form = new FormData();
    form.append("resume", f);
    try {
      const res = await fetch("/api/resume/profile", { method: "PUT", body: form });
      const data = (await res.json()) as ResumeProfile & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Could not save that resume");
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that resume");
    } finally {
      setSavingProfile(false);
    }
  }

  async function removeProfile() {
    setError(null);
    try {
      const res = await fetch("/api/resume/profile", { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Could not remove the saved resume");
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the saved resume");
    }
  }

  const poll = useCallback(async (id: string, startedAt: number) => {
    try {
      const res = await fetch(`/api/resume/jobs/${id}`, { cache: "no-store" });
      const data = (await res.json()) as ResumeJob & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Could not read job status");

      setActive(data);
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...data } : j)));

      if (data.status !== "running") { setBusy(false); return; }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setBusy(false);
        setError("Still generating after 8 minutes. Reload this page to pick it back up.");
        return;
      }
      pollRef.current = setTimeout(() => void poll(id, startedAt), POLL_MS);
    } catch (err) {
      // A failed poll is not a failed job, so keep polling; only the last
      // attempt before the timeout gives up.
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Lost contact with the server");
        return;
      }
      pollRef.current = setTimeout(() => void poll(id, startedAt), POLL_MS);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setBusy(true);
    setActive(null);

    const form = new FormData();
    // Slots are omitted entirely when empty. With both empty, Express falls
    // back to the saved base resume, so the same bytes are never re-uploaded.
    if (files.tex) form.append("tex", files.tex);
    if (files.pdf) form.append("pdf", files.pdf);
    form.append("jd", jd.trim());
    if (title.trim()) form.append("title", title.trim());
    if (company.trim()) form.append("company", company.trim());
    if (hasUpload && !profile && saveAsBase) form.append("saveAsBase", "true");

    try {
      const res = await fetch("/api/resume/jobs", { method: "POST", body: form });
      const data = (await res.json()) as ResumeJob & { error?: string; details?: string[] };
      if (!res.ok) {
        throw new Error(data?.details?.join(" ") ?? data?.error ?? "Could not start generation");
      }

      setJobs((prev) => [data, ...prev]);
      setActive(data);

      // The server promoted the upload, so reflect that without a round trip.
      const promoted = files.tex ?? files.pdf;
      if (promoted && !profile && saveAsBase) {
        setProfile({
          kind: promoted.name.toLowerCase().endsWith(".tex") ? "tex" : "pdf",
          fileName: promoted.name,
          sizeBytes: promoted.size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setFiles({});
      pollRef.current = setTimeout(() => void poll(data.id, Date.now()), POLL_MS);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start generation");
    }
  }

  async function openJob(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/resume/jobs/${id}`, { cache: "no-store" });
      const data = (await res.json()) as ResumeJob & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Could not load that result");
      setActive(data);
      if (data.status === "running") {
        setBusy(true);
        pollRef.current = setTimeout(() => void poll(id, Date.now()), POLL_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that result");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/resume/jobs/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Could not remove that entry");
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setActive((prev) => (prev?.id === id ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that entry");
    }
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ form */}
      <Card className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-4">
          <input ref={replaceRef} type="file" accept=".tex,.pdf" className="hidden"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   e.target.value = "";
                   if (f) void saveProfileFile(f);
                 }} />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Your resume <span className="text-slate-500">— attach either, or both</span>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {SLOTS.map(({ slot, label, accept, hint }) => {
                const chosen = files[slot];
                return (
                  <div key={slot}
                       className="rounded-2xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
                    <input ref={slotRef[slot]} type="file" accept={accept}
                           onChange={pick(slot)} className="hidden" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200">{label}</span>
                      {chosen ? (
                        <Button type="button" variant="ghost" aria-label={`Remove ${label}`}
                                onClick={() => clearSlot(slot)}>
                          <CloseIcon />
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost"
                                onClick={() => slotRef[slot].current?.click()}>
                          <UploadIcon /> Choose
                        </Button>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {chosen ? `${chosen.name} · ${formatSize(chosen.size)}` : hint}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* The saved base resume only matters while no file is attached. */}
            {!hasUpload && profile && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] px-3.5 py-2">
                <p className="min-w-0 truncate text-[11px] text-slate-400">
                  Using your saved resume:{" "}
                  <span className="text-slate-200">{profile.fileName}</span>
                  {" · "}{formatSize(profile.sizeBytes)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" disabled={savingProfile}
                          onClick={() => replaceRef.current?.click()}>
                    {savingProfile ? "Saving..." : "Replace"}
                  </Button>
                  <Button type="button" variant="ghost" aria-label="Remove saved resume"
                          onClick={() => void removeProfile()}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            )}

            {hasUpload && !profile && (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <input type="checkbox" checked={saveAsBase}
                       onChange={(e) => setSaveAsBase(e.target.checked)}
                       className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-accent" />
                Save as my resume, so later jobs need only a description
              </label>
            )}

            {!hasUpload && !profile && (
              <p className="mt-2 text-[11px] text-slate-500">
                Attach a .tex or a PDF — at least one.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Company <span className="text-slate-500">(names the Drive folder)</span>
              </label>
              <input value={company} onChange={(e) => setCompany(e.target.value)}
                     className="liquid-control w-full rounded-2xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                     placeholder="Acme" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Job title <span className="text-slate-500">(names the subfolder)</span>
              </label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                     className="liquid-control w-full rounded-2xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                     placeholder="Senior Backend Engineer" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Job description</label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={7} maxLength={20000}
                      className="liquid-control w-full resize-y rounded-2xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
                      placeholder="Paste the full job description." />
            <p className="mt-1 text-right text-[11px] text-slate-500">
              {jd.length.toLocaleString()} / 20,000
            </p>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-400/25 bg-red-400/10 px-3.5 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {busy ? "Generating..." : "Generate"}
            </Button>
            {busy && (
              <span className="text-xs text-slate-400">
                One to three minutes. You can leave this page and come back.
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* ---------------------------------------------------------- result */}
      {active && (
        <Card variant="solid" className="p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">
                {[active.company, active.jobTitle].filter(Boolean).join(" - ") || "Result"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {statusLabel(active)}
                {active.compileAttempts && active.compileAttempts > 1
                  ? ` after ${active.compileAttempts} compile attempts`
                  : ""}
              </p>
            </div>
            {/* Shown in every state, not only on success: the folder exists
                from the moment the job was accepted. */}
            {active.folderUrl && (
              <a href={active.folderUrl} target="_blank" rel="noreferrer" className="shrink-0">
                <Button type="button" variant="accent"><OpenIcon /> Open Drive folder</Button>
              </a>
            )}
          </div>

          {active.status === "running" && (
            <p className="text-xs text-slate-400">
              {active.pollWarning
                ? `The generator is not answering right now. Still waiting — ${active.pollWarning}`
                : "Rewriting, compiling, then the cover letter. Results appear in the folder."}
            </p>
          )}

          {active.status === "done" && (
            <div className="space-y-2">
              <p className="rounded-2xl border border-accent/25 bg-accent/10 px-3.5 py-2 text-xs text-accent">
                Done. Your tailored resume, its LaTeX source and the cover letter are in the folder.
              </p>
              {active.kind === "pdf" && (
                <p className="text-[11px] text-amber-200">
                  Built from a PDF, so this uses the one-page house template rather than your own
                  layout. Attach a .tex to keep yours.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Read it before you send it. Everything in there was written by a model.
              </p>
            </div>
          )}

          {active.status === "failed" && (
            <div className="space-y-2">
              <p className="text-xs text-red-300">
                LaTeX would not compile after 3 attempts. The full compiler log is in the folder as
                error.txt.
              </p>
              {active.error && (
                <pre className="max-h-48 overflow-auto rounded-2xl border border-red-400/25 bg-red-400/10 p-3 text-[11px] whitespace-pre-wrap text-red-200">
                  {active.error}
                </pre>
              )}
            </div>
          )}
        </Card>
      )}

      {/* --------------------------------------------------------- history */}
      {jobs.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Earlier</h2>
          <ul className="divide-y divide-white/[0.06]">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-2 py-2.5">
                <button type="button" onClick={() => void openJob(job.id)}
                        className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {[job.company, job.jobTitle].filter(Boolean).join(" - ") || job.sourceFileName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {statusLabel(job)} · {formatWhen(job.createdAt)}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {job.folderUrl && (
                    <a href={job.folderUrl} target="_blank" rel="noreferrer">
                      <Button type="button" variant="ghost" aria-label="Open Drive folder">
                        <OpenIcon />
                      </Button>
                    </a>
                  )}
                  <Button type="button" variant="ghost" aria-label="Remove entry"
                          onClick={() => void remove(job.id)}>
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            Removing an entry clears it from this list only. The Drive folder is left alone.
          </p>
        </Card>
      )}
    </div>
  );
}
