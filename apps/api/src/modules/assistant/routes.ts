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

const listMessagesQuerySchema = z.object({
  // ISO timestamp of the oldest message currently loaded in the UI —
  // omit for the newest page.
  before: z.string().datetime().optional(),
});
router.get('/assistant/messages', async (req, res, next) => {
  try {
    const { before } = listMessagesQuerySchema.parse(req.query);
    res.json(await service.listMessagesPage(userId(req), before));
  } catch (err) {
    next(err);
  }
});

const sendMessageSchema = z.object({ message: z.string().min(1) });
router.post('/assistant/messages', async (req, res, next) => {
  try {
    const { message } = sendMessageSchema.parse(req.body);
    res.status(201).json(await service.sendMessage(userId(req), message));
  } catch (err) {
    next(err);
  }
});

router.delete('/assistant/messages', async (req, res, next) => {
  try {
    await service.clearMessages(userId(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
