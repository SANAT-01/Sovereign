---
name: fe-dev
description: Build or modify frontend (Next.js) code for this project's modules. Use when writing pages, components, or client-side data fetching under /apps/web.
---

# Frontend Development (Next.js)

Rules from APPROACH.md §5/§6 — follow these for every frontend change.

## Stack
Next.js + TypeScript + Tailwind. React Query or SWR for CSR data fetching.

## Hard rule: no business logic in the frontend
- No validation rules, calculations, or domain logic in components, Server Components, or Route Handlers.
- A Route Handler used as a proxy (see below) only forwards the request/response — it does not transform data or apply rules.
- If you find yourself writing an `if` that encodes a business rule (not a UI/display rule), it belongs in the backend's `service.ts`, not here.

## Request flow — pick the right one
- **SSR** (Server Components, Server Actions, server-side fetches): call Express **directly** over the internal Docker network, e.g. `fetch('http://api:4000/expenses')`. No proxy needed.
- **CSR** (`useEffect`, React Query, SWR, any browser-side fetch): the browser cannot reach `api:4000` directly (it's internal-only). Call a same-origin Next.js Route Handler instead, e.g. `app/api/expenses/route.ts`, which forwards to Express internally and returns the response unmodified. `next.config.js` `rewrites()` is an acceptable way to implement this proxying generically for a whole path prefix (e.g. `/api/:path*`, `/auth/:path*`) instead of hand-writing a Route Handler per endpoint — use whichever is simplest for the given path, and note the choice in a short code comment since a rewrite and a Route Handler can't both claim the same exact path.

## Structure
```
/app/(modules)/<module>/        → pages/components for that module
/app/api/<module>/route.ts      → thin proxy route for CSR calls only (forward + return, nothing else) — only needed where next.config.js rewrites don't already cover the path
```

## UI
Use the shared component set (buttons, forms, layout) — don't rebuild primitives per module. Keep modules visually consistent without introducing a heavy design system. See the `ui-dev` skill for component conventions and the project's visual style reference.

## Portfolio module exception
Portfolio is public-facing, may need no auth and no DB-backed data at all — don't force it into the same authenticated-module shape as data modules (APPROACH.md §8).
