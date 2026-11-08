import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import { ValidationError } from '../../errors.js';
import type { User } from '../users/repository.js';
import * as service from './service.js';

const router = Router();
router.use(requireAuth);

// In-memory storage, same pattern as the portfolio and avatar uploads: the
// file is small, goes straight on to the generator, and is never written to
// the API's own disk. The hard byte limit is enforced in service.ts; this
// limit only stops a huge body from being buffered in the first place.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 2 },
});

// Two named slots rather than one field, so a .tex and a PDF can arrive in the
// same request. maxCount 1 each: this is one resume in two formats, not a batch.
const jobUpload = upload.fields([
  { name: 'tex', maxCount: 1 },
  { name: 'pdf', maxCount: 1 },
]);

function userId(req: { user?: unknown }): string {
  return (req.user as User).id;
}

const submitSchema = z.object({
  jd: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  skills: z.string().optional(),
  // Multipart fields arrive as strings, so this cannot be z.boolean().
  saveAsBase: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

// multipart/form-data: the job description, plus up to two files. Either slot
// may be omitted; with both empty the saved base resume is used
// (service.resolveSources). A .tex and a PDF can be sent together - the .tex
// is tailored, the PDF is kept in the Drive folder as a reference copy.
router.post('/resume/jobs', jobUpload, async (req, res, next) => {
  try {
    const input = submitSchema.parse(req.body);
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    res.status(202).json(await service.submitJob(userId(req), {
      tex: files.tex?.[0],
      pdf: files.pdf?.[0],
    }, input));
  } catch (err) {
    next(err);
  }
});

router.get('/resume/jobs', async (req, res, next) => {
  try {
    res.json({ jobs: await service.listJobs(userId(req)) });
  } catch (err) {
    next(err);
  }
});

// The frontend polls this until status is no longer 'running'.
router.get('/resume/jobs/:id', async (req, res, next) => {
  try {
    res.json(await service.getJob(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/resume/jobs/:id', async (req, res, next) => {
  try {
    await service.deleteJob(userId(req), req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- the base resume, saved once and reused for every job ------------------

router.get('/resume/profile', async (req, res, next) => {
  try {
    res.json(await service.getProfile(userId(req)));
  } catch (err) {
    next(err);
  }
});

// PUT, not POST: there is at most one base resume per user, so saving is
// idempotent and replaces whatever was there.
router.put('/resume/profile', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError('attach a resume file (.tex or .pdf) as "resume"');
    res.json(await service.saveProfile(userId(req), req.file));
  } catch (err) {
    next(err);
  }
});

router.delete('/resume/profile', async (req, res, next) => {
  try {
    await service.deleteProfile(userId(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
