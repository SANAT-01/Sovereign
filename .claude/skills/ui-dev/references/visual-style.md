# Visual Style Reference

**Final decision: back to the dark glassmorphic dashboard theme** (this project tried a light SaaS-dashboard theme in between — that attempt is superseded; this is now the settled direction). Source: `visual-reference.png` in this folder (smart-home dashboard, Dribbble reference). Motion reference: https://cdn.dribbble.com/userupload/48023814/file/b4d59b642e7860bedeac83647da58306.mp4 (micro-interactions — card hover/press states, the circular gauge animating, chart tooltip reveal — the still image can't show this; watch it before implementing animated widgets).

## Core visual language
- **Dark theme as the primary mode**, not an afterthought — cards are translucent dark panels (glassmorphism: subtle blur + low-opacity dark fill) floating over a softly blurred background image/gradient, not flat opaque dark gray.
- **Bento-grid layout**: the dashboard is a grid of cards of varying sizes (a 2x1 hero stat, several 1x1 widgets, a wide chart card) rather than a uniform list or single-column stack. Pages should read as a grid of distinct "widgets," each with one clear job.
- **Rounded corners, generously** — cards use a large radius (`rounded-2xl`/`rounded-3xl`, not `rounded-md`). Buttons and pills are fully rounded (`rounded-full`) for toggles/tags.
- **One accent color carries the UI**: a teal/emerald (`#0d3b36`-ish dark teal card fill, brighter `#2dd4a0`-ish green for active states, charts, and the "on" toggle). Secondary cards use soft pastel fills (lavender, pale yellow) purely for visual variety between widgets — not for conveying different semantic meaning.
- **Icon-forward**: every card leads with a small icon + short label rather than relying on text alone to identify what a card is about.
- **Generous internal padding** inside cards — content never touches the card edge.
- **Soft shadows, not hard borders** — cards separate from the background via blur/shadow, not a visible 1px border.

## Surface treatment: iOS-style Liquid Glass (current)
Supersedes the plain frosted-glass recipe in "Implementation notes" below. Every surface — cards, sidebar, mobile header, modals, menus, toasts — is **Liquid Glass**, defined once in `apps/web/app/globals.css` and reached through the shared primitives, never re-implemented inline:
- `Card` — `variant="glass"` (clear) / `variant="solid"` (graphite-tinted primary panel, `surface.glass` token). Both are Liquid Glass.
- `Button` — `primary` is the glossy accent "gel"; `secondary`/`accent` are glass capsules; all variants get the springy press.
- Raw classes for hand-rolled surfaces: `liquid-glass` (+ `liquid-glass-tint`), `liquid-control` (small capsules, active nav pill), `liquid-gel`, `liquid-press`, `liquid-bubble` (raised icon tiles). Floating menus/modals add `bg-surface-glass/85–90` over `liquid-glass` for text legibility.

**Tone: restrained, near-neutral glass.** The teal accent is for meaning (active state, primary action, chart series), not for surfaces. Glass tints use the graphite `surface.glass` (#16201f), never the saturated `surface.card` teal; backdrop `saturate()` stays ≤125%; background washes and orbs stay at roughly 10% opacity or lower. Chart tooltips and slice gaps use `#16201f` too (the Progress category palette was re-validated against it with the dataviz validator).

What makes it read as Liquid Glass rather than frosted glass:
- **Clearer** than frosted glass (moderate blur, boosted saturation/brightness) over **moving color** — drifting orbs in the root layout. Glass over a static background looks like a tint.
- **Edge lensing** from layered inset shadows: bright top-left rim, faint bottom-right rim, light pooled under the top edge, darker band at the bottom for thickness.
- **Light that responds**: a specular glow and a rim catch-light follow the pointer (`LiquidPointer.tsx` writes `--lg-x/--lg-y` once for the whole app). Disabled on touch devices and under reduced motion.
- **Gel-like interaction**: controls compress and spring back with a slight overshoot.
- **Floating chrome**: the sidebar and mobile header float inset from the viewport edges as rounded panels/capsules.

Rules:
- Never put Tailwind `shadow-*` or `ring-*` on a glass surface — both are box-shadows and replace the inset rim highlights. Use a `border-*` color (and optionally a faint `bg-*` tint) for emphasis instead.
- True refraction (SVG displacement in `backdrop-filter`) is deliberately not used — Chromium-only and expensive across many panels.

## Widget patterns worth reusing — now wired to this project's modules
- **Circular gauge** (the AC temperature dial in the reference) → **Progress Tracker widget**: today's goal-completion % as a radial gauge.
- **Line/area chart with a highlighted data point and tooltip** (the Energy Usage card) → **Expense Tracker widget**: spending trend over the last 30 days.
- **Compact stat row with icon + label + right-aligned value** (the Active Devices mini-cards) → **Notes widget**: recent notes/tag-frequency mini list, or a small bar chart of notes-per-day.
- **Sidebar nav with a pill-shaped active state**, grouped sections → this project's module switcher (Dashboard / Expenses / Notes / Progress / Portfolio).
- **"Good morning" summary card** → dashboard home: a soft-colored card summarizing what's new across modules.

## Dashboard charts — current phase
The modules (expenses/notes/progress) aren't built yet, so the dashboard's chart widgets render with **placeholder/sample data** for now, clearly structured so swapping in real data later is a data-source change only, not a redesign:
- Each chart widget's data comes from a small typed array at the top of its component (e.g. `sampleExpenseTrend`), shaped exactly like what the real module's API will eventually return — so wiring it up later means replacing the sample array with a fetch call, not touching the chart component itself.
- Charting library: Recharts (React-native charts, composes well with Tailwind, no heavy canvas/d3 setup needed for this project's scale).

## What NOT to copy literally
- This is a smart-home product, not a finance/notes app — don't copy its literal icons/labels, just the layout grammar.
- Don't force every module's every screen into a dashboard-grid shape — list-heavy views (a long expense history, a notes list) should still read as a clean list, using this style's card/color/spacing language rather than its grid layout specifically.

## Motion
The reference video implies: smooth, fairly quick transitions — the gauge sweeps to its value, chart tooltips fade/slide in on hover, cards give a subtle scale/opacity response on interaction, sidebar active-state slides rather than hard-cuts. Use Tailwind's `transition`/`duration-150`–`duration-300` for simple hover/press states; reach for Framer Motion only for the more deliberate widget animations (gauge sweep, chart point reveal) where CSS transitions alone would be awkward.

## Implementation notes (Tailwind)
- Glass card: `bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-lg` over a dark background, or `bg-teal-950/80 backdrop-blur` for solid-dark-teal cards.
- Keep this as the **dark-mode** visual identity — a separate light mode, if ever built, is a distinct future decision (document in APPROACH.md §14 if it happens), not an inversion to maintain alongside this theme right now.
