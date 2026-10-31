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

router.get('/progress/dashboard', async (req, res, next) => {
  try {
    res.json(await service.getDashboard(userId(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/progress/items', async (req, res, next) => {
  try {
    res.json(await service.listItems(userId(req)));
  } catch (err) {
    next(err);
  }
});

// Single generic creation endpoint — the "one modal, pick a type" UX
// (APPROACH.md §10) maps to one endpoint, not one per type.
const createItemSchema = z.object({
  type: z.enum(['daily', 'study_plan', 'interview', 'other']),
  title: z.string().min(1),
  dueAt: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
router.post('/progress/items', async (req, res, next) => {
  try {
    const input = createItemSchema.parse(req.body);
    res.status(201).json(await service.createItem(userId(req), input));
  } catch (err) {
    next(err);
  }
});

// --- Daily (streak) actions ---

const toggleDailySchema = z.object({ done: z.boolean() });
router.post('/progress/items/:id/log', async (req, res, next) => {
  try {
    const { done } = toggleDailySchema.parse(req.body);
    await service.toggleDailyToday(userId(req), req.params.id, done);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Study plan topic actions ---

const addTopicSchema = z.object({ title: z.string().min(1) });
router.post('/progress/items/:id/topics', async (req, res, next) => {
  try {
    const { title } = addTopicSchema.parse(req.body);
    res.status(201).json(await service.addTopic(userId(req), req.params.id, title));
  } catch (err) {
    next(err);
  }
});

const topicStatusSchema = z.object({ status: z.enum(['not_started', 'in_progress', 'done']) });
router.patch('/progress/items/:id/topics/:topicId', async (req, res, next) => {
  try {
    const { status } = topicStatusSchema.parse(req.body);
    res.json(await service.updateTopicStatus(userId(req), req.params.id, req.params.topicId, status));
  } catch (err) {
    next(err);
  }
});

// --- Interview actions ---

const updateInterviewSchema = z.object({
  stage: z.enum(['applied', 'referral_asked', 'interview', 'pending', 'accepted', 'rejected']).optional(),
  coveragePercent: z.number().min(0).max(100).optional(),
  dueAt: z.string().nullable().optional(),
});
router.patch('/progress/items/:id/interview', async (req, res, next) => {
  try {
    const patch = updateInterviewSchema.parse(req.body);
    res.json(await service.updateInterview(userId(req), req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

// --- Generic done toggle (used by "other" items) ---

const doneSchema = z.object({ done: z.boolean() });
router.patch('/progress/items/:id/done', async (req, res, next) => {
  try {
    const { done } = doneSchema.parse(req.body);
    res.json(await service.setItemDone(userId(req), req.params.id, done));
  } catch (err) {
    next(err);
  }
});

// --- Generic edit (title/due date, + company/role for interviews) ---

const editItemSchema = z.object({
  title: z.string().min(1).optional(),
  dueAt: z.string().nullable().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
});
router.patch('/progress/items/:id', async (req, res, next) => {
  try {
    const patch = editItemSchema.parse(req.body);
    res.json(await service.editItem(userId(req), req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

export default router;
