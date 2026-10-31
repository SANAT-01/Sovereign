---
name: be-dev
description: Build or modify backend (Express) code for this project's modules. Use when writing routes, services, or repositories under /apps/api.
---

# Backend Development (Express)

Rules from APPROACH.md §5 — follow these for every backend change.

## Stack
Express + TypeScript. Zod for request validation in `routes.ts`.

## Module shape — every module follows this exact layout
```
/apps/api/src/modules/<module>/
  routes.ts      → thin HTTP adapter: parse req (validate with Zod), call service, return res. No logic here.
  service.ts     → ALL business logic lives here. Plain functions, no Express dependency (no req/res).
  repository.ts  → DB access for this module's own tables only.
  schema.sql     → this module's migration file.
```

## Hard rules
- `service.ts` functions take plain arguments + a DB client, never `req`/`res`. This is what makes them unit-testable without HTTP and reusable from a CLI/cron job later.
- A module's `repository.ts` touches only its own tables. Need data from another module? Call that module's `service.ts` function — never reach across into another module's tables directly.
- All business logic — validation, calculations, rules — lives in `service.ts`. Nothing business-relevant lives in `routes.ts`, and nothing lives in the frontend (see `fe-dev` skill).
- Shared concerns (`auth/`, `db/client.ts`) live outside `/modules`, imported by each module — don't duplicate per module.

## Networking
Express is internal-only on the Docker network (no public Traefik route, no exposed port). It's reachable only as `http://api:4000` from Next.js or other internal services. See APPROACH.md §6.

## Before adding a new module
Confirm it's documented in APPROACH.md first (data model, exposure, any new decisions) — see the Working Agreement (§14): document before implementing.

## Reference files — read before writing non-trivial backend code
- `references/module-pattern.md` — concrete routes/service/repository code shape, with a worked example.
- `references/validation.md` — Zod request validation patterns, where validation belongs vs. where it doesn't.
- `references/error-handling.md` — consistent error responses, async error propagation, avoiding unhandled rejections.
- `references/middleware.md` — auth guard usage, cross-cutting concerns (logging, rate limiting), and what doesn't belong in middleware.
