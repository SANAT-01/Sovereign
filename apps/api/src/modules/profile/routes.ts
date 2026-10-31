import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../auth/middleware';
import type { User } from '../users/repository';
import * as service from './service';

const router = Router();
// In-memory storage — files are small (5MB cap, enforced in service.ts)
// and immediately streamed to MinIO, never written to the API's own disk.
const upload = multer({ storage: multer.memoryStorage() });

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const requester = req.user as User;
    const user = await service.getProfile(requester.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const requester = req.user as User;
    const user = await service.uploadAvatar(requester.id, req.file);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
