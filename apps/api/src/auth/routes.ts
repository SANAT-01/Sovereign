import { Router } from 'express';
import passport from './google.js';
import type { User } from '../modules/users/repository.js';

const router = Router();

// Google's redirect URI (registered in Google Cloud Console) points directly
// at this server's own origin, not the frontend's — so every redirect here
// must be an absolute URL back to the frontend, never a relative one, or the
// browser is left stranded on the API's origin after login.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

router.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  (_req, res) => {
    res.redirect(FRONTEND_URL);
  },
);

router.get('/auth/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ user: null });
  }
  const user = req.user as User;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrls: user.avatar_urls,
      homeWidgets: user.home_widgets,
    },
  });
});

router.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

export default router;
