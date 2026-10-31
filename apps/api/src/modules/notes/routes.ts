import { Router } from 'express';
import { requireAuth } from '../../auth/middleware.js';
import * as service from './service.js';

const router = Router();

router.get('/notes', requireAuth, async (_req, res, next) => {
  try {
    res.json(await service.getStatus());
  } catch (err) {
    next(err);
  }
});

export default router;
