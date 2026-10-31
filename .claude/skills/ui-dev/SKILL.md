---
name: ui-dev
description: Build or modify UI components and styling for this project. Use when creating shared components, pages, or styling with Tailwind.
---

# UI Development

Rules from APPROACH.md §11 — follow these for every UI change.

## Stack
Tailwind CSS, plus a small shared component set (buttons, forms, layout primitives) reused across every module.

## Rules
- Before building a new UI element, check whether an existing shared component already covers it. Extend/reuse before creating a near-duplicate.
- Keep modules visually consistent without reaching for a heavy design system — a handful of well-used shared primitives is enough at this project's scale.
- UI components render and display data only — no business logic here (see `fe-dev` skill). A component shouldn't decide business rules (e.g. "is this expense editable"); it receives that answer from the backend via props/data and just renders accordingly.
- The portfolio module is public-facing and may warrant a different visual treatment (marketing/showcase style) than the authenticated app modules — it doesn't need to look like the dashboard.

## Reference files
- `references/visual-style.md` — the target visual language for this project (dark glassmorphic, card/widget-based, bento grid), based on `references/visual-reference.png`. Read this before building any new screen's layout/styling.
- `references/component-patterns.md` — shared primitive structure, composition over duplication, where module-specific components live vs. shared ones.
- `references/tailwind-conventions.md` — design tokens, spacing/color consistency, dark mode, responsive patterns.
- `references/accessibility.md` — practical a11y checklist for forms, interactive elements, and keyboard navigation. Also see the installed `web-design-guidelines` skill for a fuller audit when reviewing UI.
