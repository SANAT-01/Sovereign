import { Router } from 'express';
import { requireAuth } from '../../auth/middleware';
import * as service from './service';

const router = Router();

router.get('/progress', requireAuth, async (_req, res, next) => {
  try {
    res.json(await service.getStatus());
  } catch (err) {
    next(err);
  }
});

export default router;
