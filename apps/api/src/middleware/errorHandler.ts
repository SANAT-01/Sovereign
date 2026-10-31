import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid request', details: err.issues });
  }

  const maybeStatus = (err as { status?: number; message?: string }) ?? {};
  if (maybeStatus.status) {
    return res.status(maybeStatus.status).json({ error: maybeStatus.message ?? 'Request failed' });
  }

  // Unexpected error — log full detail server-side, never leak internals to the client.
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
