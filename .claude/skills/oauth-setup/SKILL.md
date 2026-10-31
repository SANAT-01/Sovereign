---
name: oauth-setup
description: Implement or modify authentication for this project. Use when setting up Google OAuth, session handling, or auth middleware.
---

# OAuth / Auth

Rules from APPROACH.md §3 and §5 — follow these for every auth-related change.

## Method
Google OAuth (SSO) only. No password-based login, no password storage/hashing — deliberately avoided to keep the auth surface minimal for a solo dev.

## Library
Passport.js (`passport-google-oauth20`) or Auth.js. Use a signed, server-side session cookie — not a JWT stored in `localStorage` (vulnerable to XSS exfiltration, and unnecessary here since everything is same-origin per §6).

## Structure
```
/apps/api/src/auth/
  google.ts       → OAuth strategy config, callback handling
  middleware.ts   → auth guard — every module's routes.ts uses this, not its own ad hoc check
```

## Session/cookie rules
- All traffic goes through one public origin (`sanattudu.tech`, per §6) — so the session cookie is same-origin throughout, no cross-origin cookie handling needed.
- On successful Google callback: look up or create the row in the shared `users` table (keyed by Google `sub`/email), then establish the session.
- Every module route (expenses, notes, etc.) goes through the shared `middleware.ts` guard — don't write a per-module auth check.

## When adding a new identity-related feature (e.g. a second OAuth provider)
Document the decision in APPROACH.md first (§14) — this is exactly the kind of architecture-affecting change that rule covers.

## Reference files — read before implementing or modifying auth
- `references/google-oauth-flow.md` — step-by-step: Google Cloud Console setup, Passport strategy, callback handling, linking to the `users` table.
- `references/session-management.md` — cookie config, secure flags, session store choice, logout.
- `references/troubleshooting.md` — common OAuth errors (`redirect_uri_mismatch`, consent screen verification, session not persisting) and fixes.
