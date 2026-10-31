# Approach Document — Multi-Purpose Modular Platform

## 1. Goals

- **Primary**: personal daily-use tools (expense tracker, notes, progress tracker, portfolio site, more over time).
- **Secondary**: learning — build and operate the full stack yourself (frontend, backend, database, auth, deployment).
- **Tertiary**: if a module proves genuinely useful after real use, sell it cheaply.

These goals are ranked deliberately. Architecture decisions below optimize for (1) and (2) first; (3) is a possibility the architecture doesn't block, not a requirement it's built around.

## 2. Core Architectural Decision: One Modular Platform, Not Many Apps

**Decision**: build a single application with isolated feature modules (expenses, notes, progress-tracker, portfolio, ...), not separate standalone apps per feature, and not separate apps per domain.

**Why**:
- Shared auth, database, deployment pipeline, and billing setup — built once, reused by every module.
- Cross-module value stays possible (e.g. notes referencing expenses, progress tracker pulling from notes) — impossible if modules are data-siloed in separate apps.
- One codebase, one VPS, one set of security patches/updates to maintain — critical for a solo dev adding modules indefinitely.
- Selling later is simpler: one login, one dashboard, modules priced/unlocked individually if desired — not N separate purchase/signup flows.

**Why not "many small apps + a showcase SPA"**: that pattern only pays off once you have several *independently validated* products with real separate audiences — it multiplies infrastructure (auth, hosting, billing, domains) for every module, which is pure overhead while modules are still unproven. Revisit this only after 2-3 modules have real, sustained personal use.

**Scaling path kept open**: modules are structured as a *modular monolith* — isolated internally (own DB schema, own routes, communicate only through defined interfaces, not shared internals). If any single module later needs independent scaling (heavy load, separate team, separate release cycle), it can be extracted into its own service without rewriting the others. This is decided per-module, when there's an actual reason, not upfront for all modules.

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind | Single codebase, fast iteration, good for both a full app and a portfolio/marketing-style module. |
| Backend | Express + TypeScript | Chosen over NestJS for hands-on learning of HTTP/Node fundamentals (tradeoff: more boilerplate per module, offset by enforcing Nest-like structure by hand — see §5). |
| Database | PostgreSQL (self-hosted on VPS) | Relational, strong fit for structured module data (transactions, notes, tasks), full ownership for learning. |
| Auth | Google OAuth (SSO) only | No password storage/hashing to secure; works well across every module under one login; simplest viable auth for a solo dev. |
| Hosting | Self-managed VPS, domain: sanattudu.tech | Full ops ownership (deployment, TLS, backups, monitoring) — deliberate choice for the learning goal. |
| Deployment | Docker Compose (Postgres + Express + Next.js containers) behind Traefik (auto-TLS via Let's Encrypt, Docker-label-driven routing) | Traefik chosen over Caddy because it's already running on this VPS for other apps — avoids two reverse proxies competing for ports 80/443. New services join the existing `traefik-network` and get routed via container labels. |

**Explicitly decided against**: Supabase or any managed BaaS. This stack is being built and run from scratch long-term — no "ship to Supabase later" migration path is being designed for. (See git history of this conversation if that decision is ever revisited — it isn't a close call right now.)

## 4. Module List (initial → future)

| Module | Status | Notes |
|---|---|---|
| Expense Tracker | First to build | Daily-use financial logging, custom categories. |
| Notes | First to build | Daily-use free-form notes/journal. |
| Progress Tracker | Planned | Habit/goal tracking. |
| Portfolio | Planned | Public-facing showcase (different audience: visitors, not just you — see §8). |
| (more over time) | — | Added one at a time, only after the current module is in real daily use. |

**Sequencing rule**: build and personally use one module fully before starting the next. Breadth-before-depth is the exact failure mode this project is trying to avoid (see §1 — "multi-purpose app that's not great at anything").

## 5. Code Structure (Modular Monolith Pattern)

Each module is a vertical slice, isolated from the others:

```
/apps
  /web                  → Next.js frontend
    /app/(modules)/expenses
    /app/(modules)/notes
    /app/(modules)/progress
    /app/(modules)/portfolio   → may be a public route, no auth required
  /api                  → Express backend
    /src
      /modules
        /expenses
          routes.ts     → thin HTTP adapter (parses req, calls service, returns res)
          service.ts    → pure business logic functions, no Express dependency
          repository.ts → DB access for this module only
          schema.sql    → this module's tables (migration file)
        /notes
          (same shape)
        /progress
          (same shape)
      /auth
        google.ts       → OAuth strategy, session handling
        middleware.ts    → auth guard used by all module routes
      /db
        client.ts       → shared Postgres connection pool
        migrate.ts       → migration runner
      server.ts          → wires module routers into one Express app
```

**Rules that keep modules isolated**:
- A module's `repository.ts` only touches its own tables. Cross-module data access goes through the other module's `service.ts` functions — never direct cross-module SQL.
- `service.ts` functions take plain arguments and a DB client; they don't know about `req`/`res`. This keeps business logic testable and reusable (e.g. if a CLI script or scheduled job needs to call the same logic).
- Shared concerns (auth, DB connection, logging) live outside `/modules`, imported by each module — not duplicated per module.

**Why this matters for your stated plan**: this structure is what makes "add a new module" a repeatable, bounded task (new folder, same shape) instead of an ever-growing tangle, and what makes "extract this one module into its own service later" a real option instead of a rewrite.

## 6. Network Exposure & Request Flow

**Rule: only one public surface — the Next.js frontend. Everything else (Express, Postgres) is internal-only on the Docker network, never publicly reachable.**

| Component | Exposure | Reason |
|---|---|---|
| Postgres | Internal only — no published port, not even to the VPS host. Reachable only by service name inside the Docker network. | A publicly reachable database is one of the most common real-world breach vectors. No legitimate reason to expose it here. |
| Express API | Internal only — no public Traefik route. Reachable only as `http://api:4000` from inside the Docker network. | Keeps the attack surface to one domain; avoids maintaining CORS and cross-origin cookies between a frontend domain and a separate API subdomain. |
| Next.js | Public — the only service with a Traefik route (`sanattudu.tech`, TLS via Let's Encrypt). | Single public entry point for both browsers and search engines (portfolio module). |

**Request flow, by rendering mode:**

- **SSR (Server Components, Server Actions, server-side data fetching)**: Next.js's server code runs inside the VPS and calls Express **directly** over the internal Docker network (`http://api:4000/...`). No proxy needed — this is already server-to-server.
- **CSR (browser-side `fetch`, `useEffect`, React Query/SWR, etc.)**: the browser cannot reach `http://api:4000` (internal-only), so it calls a **same-origin Next.js Route Handler** (e.g. `app/api/expenses/route.ts`), which forwards the request internally to Express and returns the response. This proxy layer is the only thing that makes CSR possible without exposing Express publicly.

```
Browser (CSR)        → Next.js /api/* route handler (proxy) → Express (internal) → Postgres (internal)
Next.js server (SSR)  → Express (internal, direct, no proxy)                     → Postgres (internal)
```

**Why this over exposing Express directly** (e.g. on `api.sanattudu.tech`): that would require solving CORS and cross-origin session cookies now, and doubles the public attack surface, for no benefit at the current scale. Revisit only if a consumer that can't go through Next.js shows up (e.g. a mobile app or an external webhook target) — add a narrow, specific public Express route for just that need at that point, not a blanket public API.

**Practical implication for §5's structure**: each module's frontend gets a matching thin proxy route (`/api/expenses`, `/api/notes`, ...) for its CSR calls, alongside direct internal calls for its SSR paths. Auth session cookies stay scoped to the single `sanattudu.tech` origin throughout.

**Next.js stays presentation-only — no business logic in the frontend.** All validation, calculations, and data rules live in Express's `service.ts` layer (§5). Next.js's roles are strictly:
- Render UI.
- Make the SSR/CSR calls described above (direct internal call, or thin proxy route).
- A proxy Route Handler forwards the request/response and does nothing else — no logic, no transformation, no business rules inside it.

This keeps the frontend swappable/lightweight (easier to redesign, easier to eventually add a mobile client against the same Express API) and keeps a single source of truth for business rules in one place — Express — instead of duplicated or split across both layers.

## 7. Data Model Approach

- One Postgres database, one schema, tables prefixed or namespaced per module (e.g. `expenses_transactions`, `expenses_categories`, `notes_entries`, `notes_tags`).
- A shared `users` table (keyed by Google `sub`/email) that every module's tables reference via `user_id` foreign key — this is what makes per-user data isolation and "multi-user from day one" work.
- Per-module migration files, run in sequence by a single migration tool (e.g. `node-pg-migrate` or Drizzle) — avoids tangled, undocumented schema drift.

## 8. Special Case: Portfolio Module

Unlike the other modules, the portfolio is **public-facing** (visitors, not just you) and likely doesn't need the full auth/data-isolation machinery. Treat it as a module that:
- Doesn't require login to view.
- May not need its own database tables at all (could be static/content-driven).
- Still lives in the same Next.js app for one deployment, but routed and reasoned about differently (public routes vs. authenticated app routes).

Don't force it into the same pattern as data-heavy modules just for consistency — match the module's actual needs.

## 9. Explicitly Out of Scope (for now)

- Supabase or other managed backend — decided against, see §3.
- Separate apps per module on separate domains — decided against, see §2 (revisit only after 2-3 validated modules).
- Payment integration — design will reuse the same module pattern (own `payments` module with webhook handler) when actually needed; not built until there's something to charge for.
- NestJS — considered, Express chosen for learning; structure in §5 recovers most of the organizational benefit by hand.

## 10. Build Order

1. Shared foundation: Postgres connection, `users` table, Google OAuth flow + session middleware, base Express app wiring, base Next.js app shell with login.
2. Expense Tracker module (backend + frontend), used daily.
3. Notes module (backend + frontend), used daily.
4. Revisit: are these two modules actually used daily? If yes, proceed to Progress Tracker. If not, fix *why* before adding more surface area.
5. Portfolio module (lower priority, public-facing, can be built opportunistically).
6. Any further modules, one at a time, same rule as step 4.

## 11. Tooling & Validation per Layer

| Area | Tooling | Notes |
|---|---|---|
| **Frontend** | Next.js, TypeScript, Tailwind, React Query or SWR for CSR data fetching | Stays presentation-only per §6 — no business logic here. |
| **Backend** | Express, TypeScript, Zod (request validation in `routes.ts`) | Business logic in `service.ts`, per §5. |
| **Data Modeling** | PostgreSQL, Drizzle (or node-pg-migrate) for versioned migrations | One ERD per module, reviewed before writing migration files (§12 — document before implementing). Shared `users` table pattern per §7. |
| **OAuth** | Passport.js (`passport-google-oauth20`) or Auth.js, server-side session (signed cookie, not JWT-in-localStorage) | Session validated by `auth/middleware.ts`, reused by every module's routes (§5). |
| **Testing** | Vitest/Jest for `service.ts` unit tests (no HTTP needed — this is exactly why services are plain functions, §5); Supertest for `routes.ts` integration tests; Playwright for end-to-end flows through the UI | Unit tests are cheapest and should cover most business-rule cases; e2e reserved for the critical path per module (e.g. "create expense end to end"). |
| **UI** | Tailwind + a small shared component set (buttons, forms, layout) reused across modules, not rebuilt per module | Keeps new modules fast to build and visually consistent without a heavy design system. |

## 12. Feature Validation Workflow

**Rule: every module/feature gets validated on completion before being considered "done" — not just written and moved past.**

On completion of a feature or module, run:
1. **Automated tests** — the relevant `service.ts` unit tests and `routes.ts` integration tests (§11) must pass.
2. **A review pass** — use the `/code-review` skill (medium effort is enough for routine feature work; reserve higher effort for auth, payments, or anything security-sensitive) against the diff, to catch correctness bugs before they're considered shipped.
3. **A real run-through** — use the `/run` skill (or manually) to actually exercise the feature in the browser end-to-end, not just trust passing tests. SSR and CSR paths (§6) should both be checked where a feature touches both.

Only after all three pass does a module move to "used daily" status, which is the gate for starting the next module (§10's sequencing rule).

## 13. Revisit Triggers

Decisions above aren't permanent. Specific signals that should trigger re-evaluating a decision made here:

- A single module's load/data volume genuinely strains the shared VPS/DB → extract that module into its own service (§2's scaling path).
- You have 2-3 modules in real, validated use and distinct enough audiences → reconsider the "many apps + showcase SPA" model (§2).
- You decide to actually charge money and need tax/compliance handling across countries → revisit payment provider choice (Stripe/Razorpay vs. Lemon Squeezy/Paddle).
- VPS ops burden (patching, backups, uptime firefighting) starts costing more time than it's teaching you → revisit the "no managed backend" decision (§3).

Don't pre-solve these — build until one of these triggers actually fires.

## 14. Working Agreement

- **Document before implementing.** Any architecture-affecting decision (new module, infra choice, exposure/routing change, data model change) gets written into this document *before* code is written, not after. This file is kept current — amended in place, not left stale — as the single source of truth for why things are built the way they are.
- Code changes that follow from a decision already documented here don't need a round-trip back to this file first — only genuinely new decisions do.
- **Every feature is validated on completion**, per §12 — tests, review, and a real run-through — before being marked done.
