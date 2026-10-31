# Middleware

## What belongs in middleware
Cross-cutting concerns that apply uniformly across routes/modules:
- Auth guard (`requireAuth`) — see `oauth-setup` skill for the session/strategy setup it depends on.
- Request logging.
- Rate limiting, if/when added.
- The centralized error handler (see `error-handling.md`).

## What does NOT belong in middleware
- Business logic of any kind — that's `service.ts`'s job, not a cross-cutting concern.
- Per-module validation — that's the Zod schema in that module's `routes.ts`, not a shared middleware trying to be generic across different request shapes.

## Auth guard — one implementation, used everywhere
```ts
// /apps/api/src/auth/middleware.ts
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = { id: req.session.userId };
  next();
}
```

Every module's `routes.ts` imports this one function — don't write a per-module auth check, even if it looks trivial to inline. A single shared guard means a session/auth bug gets fixed once, not hunted down across every module.

```ts
import { requireAuth } from '../../auth/middleware';

router.get('/expenses', requireAuth, async (req, res, next) => { ... });
```

## Ordering
Global middleware (body parsing, logging) → module routers (each using `requireAuth` per-route as needed) → error handler last. The error handler must be registered after all routers, or it won't catch their errors.
