import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import type { User } from '../users/repository.js';
import * as service from './service.js';

const router = Router();
router.use(requireAuth);

function userId(req: { user?: unknown }): string {
  return (req.user as User).id;
}

router.get('/notes', async (req, res, next) => {
  try {
    res.json(await service.listNotes(userId(req)));
  } catch (err) {
    next(err);
  }
});

router.post('/notes', async (req, res, next) => {
  try {
    res.status(201).json(await service.createNote(userId(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/notes/:id', async (req, res, next) => {
  try {
    res.json(await service.getNote(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
});

const updateNoteSchema = z.object({ title: z.string().optional(), content: z.string().optional() });
router.patch('/notes/:id', async (req, res, next) => {
  try {
    const patch = updateNoteSchema.parse(req.body);
    res.json(await service.updateNote(userId(req), req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

router.delete('/notes/:id', async (req, res, next) => {
  try {
    await service.deleteNote(userId(req), req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
