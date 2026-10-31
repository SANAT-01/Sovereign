import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import type { User } from '../users/repository.js';
import * as service from './service.js';

const router = Router();
router.use(requireAuth);

// In-memory storage — same pattern as the profile avatar upload: small
// files (10MB cap, enforced in service.ts), streamed straight to MinIO,
// never written to the API's own disk.
const upload = multer({ storage: multer.memoryStorage() });

function userId(req: { user?: unknown }): string {
  return (req.user as User).id;
}

router.get('/portfolio', async (req, res, next) => {
  try {
    res.json({ sections: await service.getBoard(userId(req)) });
  } catch (err) {
    next(err);
  }
});

// --- Sections ---

const createSectionSchema = z.object({ title: z.string().min(1) });
router.post('/portfolio/sections', async (req, res, next) => {
  try {
    const { title } = createSectionSchema.parse(req.body);
    res.status(201).json(await service.createSection(userId(req), title));
  } catch (err) {
    next(err);
  }
});

const renameSectionSchema = z.object({ title: z.string().min(1) });
router.patch('/portfolio/sections/:id', async (req, res, next) => {
  try {
    const { title } = renameSectionSchema.parse(req.body);
    res.json(await service.renameSection(userId(req), req.params.id, title));
  } catch (err) {
    next(err);
  }
});

router.delete('/portfolio/sections/:id', async (req, res, next) => {
  try {
    await service.deleteSection(userId(req), req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Items ---

const createItemSchema = z.object({
  sectionId: z.string(),
  kind: z.enum(['link', 'text']), // 'document' only via the upload route below
  label: z.string().min(1),
  value: z.string().optional(),
  note: z.string().optional(),
});
router.post('/portfolio/items', async (req, res, next) => {
  try {
    const input = createItemSchema.parse(req.body);
    res.status(201).json(await service.createItem(userId(req), input));
  } catch (err) {
    next(err);
  }
});

router.post('/portfolio/items/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { sectionId, label } = z.object({ sectionId: z.string(), label: z.string().min(1) }).parse(req.body);
    res.status(201).json(await service.uploadDocument(userId(req), { sectionId, label, file: req.file }));
  } catch (err) {
    next(err);
  }
});

const editItemSchema = z.object({
  label: z.string().min(1).optional(),
  value: z.string().optional(),
  note: z.string().optional(),
  pinned: z.boolean().optional(),
});
router.patch('/portfolio/items/:id', async (req, res, next) => {
  try {
    const patch = editItemSchema.parse(req.body);
    res.json(await service.editItem(userId(req), req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

router.delete('/portfolio/items/:id', async (req, res, next) => {
  try {
    await service.deleteItem(userId(req), req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
