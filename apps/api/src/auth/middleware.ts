import type { NextFunction, Request, Response } from 'express';

// Single shared auth guard — every module's routes.ts imports this rather
// than writing its own ad hoc check (oauth-setup skill, middleware.md).
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
