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

router.get('/assistant/messages', async (req, res, next) => {
  try {
    res.json(await service.listMessages(userId(req)));
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
