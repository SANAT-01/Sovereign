import { Router } from 'express';
import * as service from './service.js';

const router = Router();

// Public — no auth guard. Portfolio is documented as public-facing
// (APPROACH.md §8), unlike every other module.
router.get('/portfolio', async (_req, res, next) => {
  try {
    res.json(await service.getStatus());
  } catch (err) {
    next(err);
  }
});

export default router;
