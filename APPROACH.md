# Approach Document — Sovereign (Multi-Purpose Modular Platform)

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
| Progress Tracker | Built | Habit/goal tracking (§10). |
| Portfolio | Planned | Private "career kit" — copyable links/documents/contact info for job applications (§9). A public showcase page is a separate, later concern. |
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

## 8. File Storage (Object Store)

**Decision: self-hosted MinIO** (S3-compatible object storage, run in Docker alongside Postgres), not a managed storage service. Consistent with §3's "no managed backend" stance — file storage is infrastructure the project owns, same as the database.

- **Why MinIO over local disk**: local disk storage (just writing files into a folder Express serves) works but doesn't give real bucket semantics (per-object public/private policy, a stable URL scheme, straightforward backup/replication later) and ties uploaded files to one server's filesystem — harder to move or scale later. MinIO gives S3-compatible semantics now, for free, self-hosted.
- **Why not a managed service** (S3, Cloudinary, etc.): same reasoning as §3 — this project is built and run from scratch, not assembled from managed pieces, and MinIO's free/self-hosted at this scale costs nothing extra to run alongside the existing Postgres container.
- **Bucket layout**: one bucket (e.g. `multi-purpose-uploads`), objects namespaced by purpose and user id (e.g. `avatars/<user_id>.jpg`) — same per-user-isolation spirit as the Postgres tables in §7, just for files instead of rows.
- **Public vs. private objects**: profile avatars are set public-read at the bucket/prefix level (they're meant to be displayed, e.g. in the sidebar) — this is a deliberate exception to "nothing public but the frontend" in §6, scoped to object storage, not every service. Future modules needing private file storage (e.g. a notes attachment) would use presigned URLs instead of a public policy — decide that per use case when it comes up, don't default to public.
- **Access pattern**: Express is the only thing that talks to MinIO directly (internal Docker network, like Postgres) — it handles the upload (via `multer` for multipart parsing) and returns a public object URL to the frontend. The frontend never talks to MinIO directly; this keeps the storage layer behind the same module-boundary discipline as everything else (§5's `service.ts`/`repository.ts` pattern, with a `storage.ts` lib wrapping the MinIO client).
- **Local dev vs. production**: MinIO's public object URL needs its own exposed port/subdomain to actually be loadable by a browser (unlike Postgres, which only Express talks to) — locally this is `http://localhost:9000/<bucket>/...`; in production this needs either a Traefik route to MinIO's own subdomain (e.g. `files.sanattudu.tech`) or having Express proxy/redirect to it. Decide the production exposure when actually deploying — not a blocker for local development now.

## 9. Portfolio Module Design

**Superseded design note**: this module was originally scoped as a public-facing resume/showcase page (visitors, not just you) needing no auth or tables. That's still a plausible *future* module, but it was never built, and the real near-term need turned out to be different — a **private "career kit"**: every link, document, and detail needed when filling out a job application (GitHub, LinkedIn, resume, portfolio site, phone, deployed projects), each one copyable in one click, so applying doesn't mean hunting across five open tabs. That's what's specified below. If a public showcase page gets built later, it's a separate concern (public routes, no auth) layered on top of this, not a replacement for it.

**Data model** — same "generic, not one-table-per-type" philosophy as Progress Tracker (§10), and the same reason: full flexibility to add sections and items without a migration.

```
portfolio_sections (
  id, user_id, title, position, created_at
)
portfolio_items (
  id, user_id, section_id, kind, label, value, note, pinned, position, created_at
)
```

- **No fixed section list.** "Profiles" / "Deployed Applications" / "Documents" / "Contact" are starting defaults a new account sees, not a schema constraint — rename, delete, or add any section (e.g. "Visa Status", "References") from the UI, same as Progress Tracker's user-defined categories.
- **`kind`** is the only thing that changes an item's behavior: `'link'` (value = URL; Copy + Open), `'document'` (value = MinIO public URL from an uploaded file, via the same `uploadPublicFile` helper the avatar feature already uses — not a new storage mechanism; Copy link + Download), `'text'` (value = plain text like a phone number or location; Copy only, no Open).
- **`note`** is a free-text secondary line — a document's size/upload date, a deployed app's stack tags, or nothing.
- **`pinned`** marks an item as one of the first things you'd need (GitHub, LinkedIn, resume) — persisted, not yet wired into the home-screen widget (§10's `home_widgets` pattern could pick this up later if wanted, but that's not built now).
- **Empty state is a real empty state** — a new account has zero sections, not fabricated placeholder "Profiles"/"Documents" rows (same "don't fabricate progress" principle §10 established, applied here to "don't fabricate your own links").
- **Private, authenticated, standard data-isolation** — `requireAuth` + `user_id` on every row, same as every other real module. (This is the correction to the original "no auth" assumption above.)
- **Read vs. Edit mode is pure client-side UI state**, not a backend concept — Edit mode reveals rename/delete controls on sections and items plus "add" affordances; Read mode (default) stays a clean, fast copy surface. No persistence needed for which mode you're in.
- **"Copy everything as text"** is a frontend-only convenience (formats the already-fetched items into one pasteable block) — no dedicated endpoint.

## 10. Progress Tracker Module Design

**Revised to a generic items model** (supersedes an earlier one-table-per-type draft) — the project owner explicitly wants new tracked-item types addable later without a schema migration each time. So instead of a dedicated table per type, the `progress` module has two tables total:

```sql
progress_items (
  id, user_id, type, title, status,
  due_at,             -- "the date that matters" for this item (interview date, plan due date); null if not applicable
  last_activity_at,   -- generic staleness signal — updated whenever the item is meaningfully touched
  data,               -- JSONB — everything type-specific lives here (coverage %, stage, company/role, topics[], repeats, ...)
  created_at
)

progress_item_logs (
  id, item_id, user_id, log_date   -- generic daily-completion log, usable by any "streak-able" type, not just today's "daily"
)
```

**Why this shape**: `due_at` and `last_activity_at` are generalized across every type (not "scheduled_at" for interviews and "due_date" for plans as separate columns), so the dashboard's "what's coming up" and "what's gone stale" queries are each one generic query across all items, not N per-type queries. `data` (JSONB) holds whatever a type needs without a migration. `progress_item_logs` stays a real table (not JSONB-in-`data`) because per-day completion genuinely benefits from relational queries (streak math, the heatmap) — but it's keyed generically off `item_id`, so any future type that wants a streak gets one for free.

**Current types** (selected via one generic "add item" modal — a `type` dropdown, not one form per type):
| Type | Widget | `data` shape | Uses `progress_item_logs`? |
|---|---|---|---|
| `daily` | Streak + 30-day heatmap | `{}` (nothing extra needed) | Yes |
| `study_plan` | % coverage bar (topics done ÷ total), computed, not stored, with the topic list underneath for the "last touched" resume point | `{ topics: [{ id, title, status, lastTouchedAt }] }` | No |
| `interview` | Stage stepper (Applied → Referral asked → Interview → Accepted/Rejected) + a prep-coverage % bar once scheduled | `{ company, role, stage, coveragePercent, referralApplicable }` (`due_at` = the scheduled interview date) | No |
| `other` | Plain to-do with optional due date | `{ repeats }` (`due_at` = the due date) | No |

A "mock interview prep" item is just a `daily` item named accordingly — not its own type, since it needs the same heatmap widget.

**The dashboard is the actual feature.** Per-type CRUD is necessary plumbing, but the thing that solves "I forget what I planned" is a single aggregating view, surfaced first on opening the module, computed by one `service.ts` function (`getDashboard(userId)`):
- `daily` items: current streak + at-risk-today flag + heatmap.
- Items (any type) stale: `status != 'done' AND last_activity_at < now() - N days` — one generic query, not one per type.
- Items (any type) due soon: `due_at BETWEEN now() AND now() + 3 days` — same genericity.
- Open `other` items, due-soonest first.

**Explicitly deferred for this pass**: browser push notifications and email digests. The on-open dashboard is the v1 solution to "forgetting"; revisit only if the dashboard alone proves insufficient once actually used daily (§14's validation gate applies here too — this module isn't "done" until it's used for real).

## 11. Explicitly Out of Scope (for now)

- Supabase or other managed backend — decided against, see §3.
- Separate apps per module on separate domains — decided against, see §2 (revisit only after 2-3 validated modules).
- Payment integration — design will reuse the same module pattern (own `payments` module with webhook handler) when actually needed; not built until there's something to charge for.
- NestJS — considered, Express chosen for learning; structure in §5 recovers most of the organizational benefit by hand.

## 12. Build Order

1. Shared foundation: Postgres connection, `users` table, Google OAuth flow + session middleware, base Express app wiring, base Next.js app shell with login.
2. Expense Tracker module (backend + frontend), used daily.
3. Notes module (backend + frontend), used daily.
4. Revisit: are these two modules actually used daily? If yes, proceed to Progress Tracker. If not, fix *why* before adding more surface area.
5. Portfolio module (lower priority, public-facing, can be built opportunistically).
6. Any further modules, one at a time, same rule as step 4.

## 13. Tooling & Validation per Layer

| Area | Tooling | Notes |
|---|---|---|
| **Frontend** | Next.js, TypeScript, Tailwind, React Query or SWR for CSR data fetching | Stays presentation-only per §6 — no business logic here. |
| **Backend** | Express, TypeScript, Zod (request validation in `routes.ts`) | Business logic in `service.ts`, per §5. |
| **Data Modeling** | PostgreSQL, Drizzle (or node-pg-migrate) for versioned migrations | One ERD per module, reviewed before writing migration files (§16 — document before implementing). Shared `users` table pattern per §7. |
| **OAuth** | Passport.js (`passport-google-oauth20`) or Auth.js, server-side session (signed cookie, not JWT-in-localStorage) | Session validated by `auth/middleware.ts`, reused by every module's routes (§5). |
| **Testing** | Vitest/Jest for `service.ts` unit tests (no HTTP needed — this is exactly why services are plain functions, §5); Supertest for `routes.ts` integration tests; Playwright for end-to-end flows through the UI | Unit tests are cheapest and should cover most business-rule cases; e2e reserved for the critical path per module (e.g. "create expense end to end"). |
| **UI** | Tailwind + a small shared component set (buttons, forms, layout) reused across modules, not rebuilt per module | Keeps new modules fast to build and visually consistent without a heavy design system. |

## 14. Feature Validation Workflow

**Rule: every module/feature gets validated on completion before being considered "done" — not just written and moved past.**

On completion of a feature or module, run:
1. **Automated tests** — the relevant `service.ts` unit tests and `routes.ts` integration tests (§13) must pass.
2. **A review pass** — use the `/code-review` skill (medium effort is enough for routine feature work; reserve higher effort for auth, payments, or anything security-sensitive) against the diff, to catch correctness bugs before they're considered shipped.
3. **A real run-through** — use the `/run` skill (or manually) to actually exercise the feature in the browser end-to-end, not just trust passing tests. SSR and CSR paths (§6) should both be checked where a feature touches both.

Only after all three pass does a module move to "used daily" status, which is the gate for starting the next module (§12's sequencing rule).

## 15. Revisit Triggers

Decisions above aren't permanent. Specific signals that should trigger re-evaluating a decision made here:

- A single module's load/data volume genuinely strains the shared VPS/DB → extract that module into its own service (§2's scaling path).
- You have 2-3 modules in real, validated use and distinct enough audiences → reconsider the "many apps + showcase SPA" model (§2).
- You decide to actually charge money and need tax/compliance handling across countries → revisit payment provider choice (Stripe/Razorpay vs. Lemon Squeezy/Paddle).
- VPS ops burden (patching, backups, uptime firefighting) starts costing more time than it's teaching you → revisit the "no managed backend" decision (§3).

Don't pre-solve these — build until one of these triggers actually fires.

## 16. Working Agreement

- **Document before implementing.** Any architecture-affecting decision (new module, infra choice, exposure/routing change, data model change) gets written into this document *before* code is written, not after. This file is kept current — amended in place, not left stale — as the single source of truth for why things are built the way they are.
- Code changes that follow from a decision already documented here don't need a round-trip back to this file first — only genuinely new decisions do.
- **Every feature is validated on completion**, per §14 — tests, review, and a real run-through — before being marked done.

## 17. Production Deployment & Docker

There is **one Dockerfile per app, and it only builds the production image** — no dev stage, no hot reload, no dev dependencies in the final image. `docker-compose.yml` (local) and `docker-compose.prod.yml` (VPS) build and run the exact same image; the only differences between them are infra (published ports, pgAdmin, Traefik labels, credentials source), not the image itself.

- **api**: a `deps` stage installs only production dependencies, a `build` stage runs `tsc` to produce `dist/`, and the final stage copies just `node_modules` (prod-only) + `dist/` — no source, no dev deps, no build tooling in the shipped image. Runs as a non-root `app` user. Boots with `node dist/db/migrate.js && node dist/index.js` — migrations stay idempotent so this is safe on every restart.
- **web**: uses Next's `output: "standalone"` (set in `next.config.js`) so the `build` stage's trace step bundles only the dependencies actually reachable at runtime; the final stage copies just `.next/standalone` + `.next/static`. Runs as a non-root `app` user, serves via `node server.js`.
- **Consequence for local iteration**: since the containers run compiled output, not live source, code changes require `docker compose up --build` to take effect — there's no bind-mount hot reload inside Docker. The host-based scripts (`npm run dev` / `dev:api` / `dev:web`, per root `package.json`) remain the fast iteration path for active development; the container path is for running/validating the app as it will actually run in production, locally or on the VPS.
- **Prerequisite fixed to make this possible**: the API's `tsconfig.json` uses `moduleResolution: "nodenext"`, which requires explicit `.js` extensions on relative imports. This was previously unfixed (tsx tolerates it at dev time, masking the problem) but blocks `tsc` from emitting at all — fixed project-wide as part of standing up the production build, since `npm run build` is now a real, used path instead of a defined-but-untested script.
- **`docker-compose.prod.yml`** (separate from the dev `docker-compose.yml`, not profiles on one file — different enough in shape: no bind mounts, no pgAdmin, Traefik labels, prod Dockerfiles) mirrors §6's exposure model:
  - `db`: internal only, no published port, even to the VPS host.
  - `minio`: internal only to Express for the S3 API; its public object URL is reached through a **dedicated Traefik route on its own subdomain** (`files.sanattudu.tech`), per the option §8 left open — chosen over having Express proxy file bytes, since that would put binary file streaming load on the API process for no benefit.
  - `api`: internal only, no published port — reachable solely as `http://api:4000` inside the `traefik-network`/compose network, same as dev.
  - `web`: the only service with a public Traefik route (`sanattudu.tech`, TLS via Let's Encrypt, Docker-label-driven per §3).
  - All services join the VPS's existing external `traefik-network` (`docker network` already used by other apps on the box) in addition to this project's own internal network — internal-only services don't need the external network at all.
- Images are tagged and built via `docker compose -f docker-compose.prod.yml build`; deploying means pulling/building on the VPS and `docker compose -f docker-compose.prod.yml up -d`. No CI/registry push pipeline yet — build directly on the VPS until that becomes a real bottleneck (§15).

## 18. Notes Module Design

Unlike Progress Tracker (§10) and Portfolio (§9), a note doesn't need a generic items/categories model — it's just a title and some rich-text content. One table:

```
notes (
  id, user_id, title, content, created_at, updated_at
)
```

- **Editor**: Tiptap (React rich-text library built on ProseMirror), not raw `contentEditable` + `document.execCommand`. The design mockup used `execCommand` because it's zero-dependency for a quick demo, but it's a deprecated browser API with real cross-browser inconsistencies (nested lists, undo/redo, Safari quirks) — not something to build the real editor on. Tiptap outputs the same plain HTML `execCommand` would have, so the storage model doesn't change, just what produces it.
- **Sanitization**: `content` is rendered back via `dangerouslySetInnerHTML`, so every save runs through `sanitize-html` server-side first (strip `<script>`, event-handler attributes, etc.) — a new concern this module introduces, since no other module stores and re-renders arbitrary HTML.
- **List endpoint stays lightweight**: `GET /notes` returns `id`, `title`, a server-computed plain-text snippet (HTML stripped, truncated ~140 chars), and `updated_at` — not full content for every note just to render previews. Full `content` is fetched only via `GET /notes/:id` when a note is opened.
- **Autosave + manual save, same endpoint**: `PATCH /notes/:id` is called both by a ~1.2s debounce after typing stops (matching the mockup) and by an explicit Save button that bypasses the debounce — one code path, two triggers.
- **New note is a real row immediately**: clicking "+ New note" calls `POST /notes` right away (empty title/content) rather than holding a local-only draft, so autosave always has a real id to target from the first keystroke.
- **No conflict resolution** — last-write-wins on `PATCH`. Fine for single-user, single-device; revisit only if this ever needs simultaneous multi-device editing, which isn't the ask.
- **Search is client-side** — substring filter over the already-loaded title+snippet list. No Postgres full-text search infrastructure; not worth it at personal-notes volume, easy to add later if it ever matters.
- **Delete** is included (standard CRUD hygiene) even though the mockup didn't show it — a small trash affordance on hover in the list.
- **Mobile layout**: the list+editor two-pane layout collapses to one pane at a time below `lg` (same breakpoint `Sidebar.tsx` already uses for its own off-canvas pattern) — list view by default, tapping a note switches to a full-width editor view with a "← Notes" back control, rather than squeezing both panes side by side on a phone.

## 19. Assistant (Chatbot) Module Design

A chat assistant that answers questions about *your own* data (notes, progress, portfolio, expenses) using a self-hosted LLM gateway (`freellmapi`, a server the user runs on their own VPS) — **not** a per-user API key. Originally built around a Gemini key each user pasted into Profile; superseded once a free, self-hosted OpenAI-compatible LLM endpoint became available, since there was no longer a reason to make every user find and manage their own key for a single-user app.

**The core safety decision: no direct database access for the model, ever — not even read-only SQL.** A read-only Postgres role still lets a model write arbitrary `SELECT`s across every user's rows; "read-only" isn't the same as "scoped to one user." Instead:

- The model only ever sees a **fixed, small set of tool functions** (OpenAI-style `tools`/function-calling) — `search_notes`, `get_note_detail`, `get_progress_summary`, `list_progress_items`, `list_portfolio_items`, `get_expense_summary`, `search_expenses`. No `update_*`/`delete_*` tool exists, so the model cannot mutate anything regardless of what it's asked to do — `expenses/service.ts`'s `updateExpense`/`deleteExpense`/`importExpenses` are deliberately never wrapped, same as every other module.
- **Every tool function hardcodes `user_id` from the authenticated session** — it is never a parameter the model supplies or sees. The model can ask for "my notes about interviews," but there is no tool that takes a `user_id` argument at all, so it's architecturally impossible for it to fetch another account's data, not just policy-discouraged.
- Each tool is a thin wrapper around the **existing module service functions** (`notes/service.ts`'s `listNotes`, `progress/service.ts`'s `getDashboard`/`listItems`, `portfolio/service.ts`'s `getBoard`, `expenses/service.ts`'s `getChartData`/`listExpenses`) — no new business logic duplicated, just new callers. `search_expenses` hardcodes `pageSize: 20` regardless of what the model asks for, same "bound the cost of one request" reasoning as `MAX_TOOL_ROUNDS` below — a chat answer never needs the full ledger, just enough rows to answer the question, and the tool result's `total` field tells the model (and it should tell the user) when there's more than what's shown.

**LLM access**: one server-wide `FREELLM_API_URL`/`FREELLM_API_KEY`/`FREELLM_MODEL` (default `"auto"`, freellmapi's own model router) — lazily read/validated on first actual use (`assistant/service.ts`'s `getConfig()`), same pattern as `lib/mailer.ts`'s SMTP config and `lib/kafka.ts`'s broker config, so a deployment that never uses the assistant doesn't fail to boot over an unset env var. The endpoint is an OpenAI-compatible `/v1/chat/completions` — called with plain `fetch`, no SDK, since it's one JSON POST with a bearer token. No per-user secret exists anymore; there is nothing for the Profile page to show or let the user manage here.

**Chat history persisted**: one table —
```
chat_messages (
  id, user_id, role, content, created_at
)
```
One continuous conversation per user (no multi-thread/conversation management in v1 — that's real scope beyond what's asked). `role` is `'user'` or `'assistant'`; tool-call/tool-result exchanges happen only in-memory during a single request and are not persisted as separate rows — only the final user message and final assistant text go in the table, same as what a user would actually see.

**UI history is paginated separately from the LLM's context window.** `GET /assistant/messages` (`service.ts`'s `listMessagesPage`) returns the most recent 10 messages plus a `hasMore` flag, and accepts a `before` cursor (the oldest loaded message's `created_at`) to fetch the next older page as the user scrolls up — deliberately a different code path from `sendMessage`'s own `repository.listMessages(userId, HISTORY_LIMIT)` (20, unpaginated) that builds what the model sees, so changing one page size never accidentally changes the other.

**System prompt**: every request includes a fixed system message covering three things, so the model doesn't have to infer them — (1) **role**: "you are the assistant inside Sovereign, a private personal app — you help the user recall and understand their own notes, progress tracking, and career/portfolio links"; (2) **behavior rules**: always use a tool to fetch real data rather than guessing, say plainly when nothing matches rather than inventing an answer, stay concise; (3) **data model**, a short description of what each tool returns and what the fields mean (e.g. a progress item's `type` is `daily`/`study_plan`/`interview`/a user-defined category, `data` holds type-specific fields like an interview's `stage`/`company` or a study plan's `coveragePercent`) — without this the model has no way to know an interview's `stage` values or that a `null` `coveragePercent` means "no topics yet," not "0%."

**Request flow** (`POST /assistant/messages`, non-streaming for v1):
1. Load recent history (last ~20 messages) for context.
2. Call freellmapi with the tool definitions + history + new message.
3. If the model responds with `tool_calls`, execute each matching tool (scoped to the session's `user_id`) and feed the results back as `role: "tool"` messages; repeat up to a small fixed cap (5 rounds) to bound cost/latency if the model loops.
4. Persist the user message and the final assistant reply; return the reply.

**UI**: a new "Assistant" page in the sidebar nav (own module, same pattern as every other module), not a floating cross-page widget — simpler to build and reason about, and matches how every other module here is just its own page. No API-key field on Profile anymore — the chat is always available once the server-side env vars are set.

## 20. Expense Tracker Module Design

Built in two phases — **Phase 1: import & log** (this pass), **Phase 2: charts** (next pass, after the log is in real use, same sequencing discipline as §1/§4).

**The real insight driving this design**: a raw SBI bank statement export is a password-protected file whose transaction `Details` column is dense, inconsistent bank shorthand (`UPI/DR/807430986080/Zepto/YESB/ZEPTOONLIN/Payment`, `NEFT*KKBK0000958*CMS...*WINJIT TECHNOLO`) — not something worth writing a regex parser for in this app, since truncation and format vary by transaction type and bank. Instead, the user's own Claude session does that semantic extraction (name, UPI handle, merchant vs. person) into a clean intermediate sheet matching this app's template; this app only ever imports a file already in that shape. The app's job is the template + the import + the storage, not bank-statement parsing.

**Data model** — one table:
```
expenses (
  id, user_id, date, details, ref_no, debit, credit, balance,
  counterparty_name, upi_id, merchant_name, created_at
)
```
`debit`/`credit` are mutually exclusive per row (matches the source statement convention — one or the other, never both). `upi_id`/`merchant_name` are nullable — blank for a NEFT/cheque transaction or a person-to-person transfer respectively.

**Template columns** (in order): `Date, Details, Ref No/Cheque No, Debit, Credit, Balance, Counterparty Name, UPI ID, Merchant Name`. `GET /expenses/template` downloads a `.xlsx` with just this header row plus one example row (so a user's own Claude session sees the expected shape, per the xlsx skill's "fill-in template needs an example row" convention) — generated on demand, not a static file, so column changes never need a file to be regenerated and re-deployed by hand.

**Import** (`POST /expenses/import`, multipart `.xlsx`): parsed server-side, validated against the exact header row (fail the whole import with a clear error if headers don't match — silently guessing at a misaligned column is worse than refusing), rows inserted.

**Dedupe on re-import**: skip a row if `(date, debit, credit, balance)` already exists for that user, rather than erroring the whole import or duplicating. Deliberately not `(date, ref_no, balance)` — `ref_no` is blank on most real UPI rows (confirmed from the actual reference statement), so it can't be part of the key. The running `balance` is effectively unique per transaction in practice, so `(date, debit, credit, balance)` together reliably identifies "the same transaction," letting a user re-export overlapping date ranges from the bank without creating duplicates.

**Phase 1 scope**: template download, import, and a plain transaction table/log view. No charts yet — that's explicitly deferred to Phase 2, same as this project's standing "one module, fully working, before the next layer" discipline.

## 21. Reminders (Email Digest) Module Design

Revisits the deferral in §10 ("email digests... revisit only if the dashboard alone proves insufficient") — not a new concept, just a scheduled delivery mechanism for a dashboard that already exists.

**No new "what's due" logic.** Progress Tracker's `getDashboard(userId)` (`progress/service.ts`) already computes everything reminder-worthy — `dueSoon`, `staleInterviewsOrOther`, `staleStudyTopics`, `dailyAtRisk` — using the same thresholds (`STALE_DAYS`, `DUE_SOON_DAYS`) the dashboard page itself renders. The email digest calls this exact function and formats its result; it does not duplicate or re-derive any query.

**Delivery**: `nodemailer` over Gmail SMTP, using the app's own sender account (env vars `SMTP_USER`/`SMTP_APP_PASSWORD`, an app password — not OAuth), sent to the signed-in user's own `users.email`. Single recipient, no per-user SMTP config — this is a self-hosted single-user app, same reasoning as why `CHAT_KEY_ENCRYPTION_SECRET` is one server-wide secret, not per-user. SMTP config is validated lazily (only when a send is actually attempted), same pattern as `lib/crypto.ts`'s `getKey()` — missing/incomplete SMTP env vars must not crash the API at boot.

**Preferences** — one new JSONB column, same "add a column to `users`" precedent as `home_widgets`/`progress_chart_prefs`/`gemini_api_key_encrypted`:
```
notification_prefs JSONB NOT NULL DEFAULT
  '{"enabled": false, "intervalMinutes": 1440, "lastSentAt": null}'
```
`intervalMinutes` is user-configurable from Profile (default 1440 = daily). **Minimum interval is enforced server-side only when `NODE_ENV === 'production'`** (`MIN_PROD_INTERVAL_MINUTES = 360`, i.e. 6 hours) — explicit product decision: short intervals (down to 1 minute) must stay available in dev for testing the job itself, but production never sends more often than every 6 hours regardless of what was saved before the environment flipped.

**Scheduler**: a single `setInterval` tick every 60 seconds (`apps/api/src/jobs/reminders.ts`), started once from `index.ts` after the server starts listening. This is a modular monolith (§2); a scheduled job inside the same process is consistent with that, not a reason to introduce a worker process or a cron library for one recurring check. Each tick finds every user with `notification_prefs.enabled` where `now - lastSentAt >= intervalMinutes`, **but no longer sends the email itself** — since §22, it only publishes a `reminders.send` Kafka message per due user; the actual `getDashboard` + send happens in a consumer. See §22 for the full producer/consumer split, including why `lastSentAt` updates optimistically at enqueue time rather than after the send.

**Reentrancy guard**: `setInterval` does not wait for an async callback to finish before firing again — a tick that runs longer than 60s (many users, a slow publish) would otherwise start concurrently with the one still running, piling up overlapping DB queries and publishes instead of just running a little late. A module-level `tickInFlight` flag makes ticks strictly sequential; an overlapping fire is skipped (logged) rather than stacked. The SMTP transport is also a cached singleton (`pool: true`, `maxConnections: 1` in `lib/mailer.ts`) rather than opened fresh per send, for the same "don't let per-call overhead compound" reason.

**Email content**: one digest per send, grouped the same way the dashboard page groups them (at-risk daily habits, due-soon interviews/items, stale items, stale study topics) — the email is a text rendering of the same dashboard data, not a separate editorial format.

**Profile UI**: new "Reminders" card (same `Card variant="glass"` pattern as the Gemini key section) — enable/disable, an interval-in-minutes input (helper text notes the 3-hour production floor), and a read-only "last sent" timestamp for visibility that the job is actually running.

**Explicitly out of scope for this pass**: per-module opt-in/opt-out (it's everything `getDashboard` returns, or nothing), multiple recipients, and any delivery channel besides email (WhatsApp was considered and deferred — see chat history — email is simpler, free at this volume, and needs no template-approval process).

## 22. Kafka Event Bus

**This is more infrastructure than the reminders use case alone needs.** A single-user reminders job could run entirely in-process (as it briefly did, before this section was written) with no message broker at all. Kafka was added here as a deliberate choice — a general-purpose event bus for future inter-module events, and to work with Kafka directly — not because reminders at this scale demanded it. Documented honestly, in the same spirit as this project's other acknowledged tradeoffs (§2, §15): this is a deviation from "minimal infra until there's a real reason," made knowingly, not accidentally.

**Client**: `apps/api/src/lib/kafka.ts` wraps `kafkajs` with exactly two operations — `publish(topic, key, payload)` and `registerConsumer({topic, groupId, onMessage})` — deliberately minimal so a future module (expenses, portfolio) can plug into the same bus without needing anything new from this file. `KAFKA_BROKERS`/`KAFKA_CLIENT_ID` are validated lazily, only on first actual publish/consume, same pattern as `lib/mailer.ts`/`lib/crypto.ts` — a deployment that never touches Kafka doesn't fail to boot over it.

**Topic naming**: `<module>.<event>`, dot-namespaced in Kafka's flat topic namespace — each module owns its own first segment, so topic names can't collide. First topics: `reminders.send` (3 partitions, keyed by `userId` so one user's messages always land on the same partition — gives per-user ordering for free) and `reminders.send.dlq` (1 partition — a low-volume inspection sink, ordering across users doesn't matter there). Topics are **pre-created explicitly** by a `kafka-init` one-shot container (mirrors `minio-init`'s exact pattern — retry-loop until the broker is ready, then create idempotently) rather than relying on auto-topic-creation, which is disabled (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`).

**Reminders as producer + consumer**: the scanner (`jobs/reminders.ts`, still the 60s `setInterval` from §21) now only finds due users and publishes to `reminders.send` — it no longer calls `getDashboard`/`sendMail` at all. A separate consumer (`jobs/reminders-consumer.ts`), registered once at boot (`index.ts`), does the actual digest-building and sending.

**Why `lastSentAt` updates optimistically, at enqueue time**: the scanner is the only thing that knows "is this user due," on a fixed clock. If it waited for the consumer to finish before advancing `lastSentAt`, a slow or backed-up consumer would leave the timestamp stale — and the very next tick would see the same user as still-due and publish a second message before the first is even processed. Claiming the slot immediately (update `lastSentAt`, *then* publish) prevents that pile-up. The accepted tradeoff: if a send ultimately fails, the user still waits a full interval before the scanner reconsiders them — acceptable, because retries for that one message live entirely inside the consumer now, not in the scanner re-driving.

**In-memory in-flight guard**: a second, narrower safety net — an exported `inFlightUserIds` Set in `jobs/reminders.ts`, checked by the scanner and cleared by the consumer when a message finishes (success or exhausted retries) — covers the small remaining window between a tick starting and its DB write landing. **Known simplification**: correct here because the scanner and consumer run in the same Node process (modular monolith, §2); it would NOT be correct if this app ever ran as multiple API instances, since the Set wouldn't be shared across processes — revisit via Kafka's own per-partition ownership (the `userId` key already gives per-user ordering) if horizontal scaling is ever introduced.

**Retry + DLQ**: a failed send (SMTP error) retries up to 3 times with a short linear backoff (2s, 4s) inside the single message handler — short, because this blocks only that one message's partition, not the whole system. If all 3 attempts fail, the message (plus the error and attempt count) is republished to `reminders.send.dlq`, logged loudly (`[DLQ] ...`), and the original offset still commits — a poisoned message never blocks the partition forever. The DLQ is **inspect-only** this pass; nothing auto-retries it — an explicit scope cut, same spirit as §21's own "explicitly out of scope" list.

**Dual listeners (dev)**: the containerized `kafka` service exposes two listeners — `PLAINTEXT` (`kafka:19092`, container-to-container, used by the containerized `api` service in `dev:all`/prod) and `PLAINTEXT_HOST` (`localhost:9092`, published, used by the host-run API process in normal day-to-day `npm run dev`). Postgres/MinIO don't need this because their dev containers only ever need the one published-port address; Kafka needs both because the host-run dev process and the containerized `api` service must reach the *same* broker from two different network vantage points, and no single advertised address resolves correctly as both `kafka` (container DNS) and `localhost` (host) to the same client. Verified against the official `apache/kafka` image's own example single-node KRaft compose file, pinned at `apache/kafka:4.4.0`.

**Explicitly out of scope for this pass**: any consumer/retry logic on the DLQ topic itself, schema validation on published payloads (the bus is intentionally payload-agnostic — a future module validates its own shape with zod if it wants to), and graceful shutdown wiring (`lib/kafka.ts` exposes `shutdownKafka()` but nothing calls it yet — this app has no shutdown-hook convention elsewhere either).
