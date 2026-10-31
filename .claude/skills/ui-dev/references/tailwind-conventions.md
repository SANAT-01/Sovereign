# Tailwind Conventions

## Design tokens via Tailwind config, not inline magic values
Define the palette, spacing scale, and font sizes once in `tailwind.config.ts`, and use the generated utility classes everywhere — don't hardcode one-off hex colors or pixel values in `className` strings.

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: { 50: '#...', 500: '#...', 900: '#...' },
        surface: 'var(--surface)',
      },
    },
  },
};
```

## Dark mode
Use Tailwind's `dark:` variant driven by a `class` strategy (not `media`), so the app can offer an explicit light/dark toggle rather than only following system preference:
```ts
// tailwind.config.ts
export default { darkMode: 'class', ... };
```
```tsx
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
```
Define colors as CSS variables redefined per theme where a component's styling gets complex, rather than sprinkling `dark:` on every single utility — keeps components readable as the module list grows.

## Responsive patterns
Mobile-first by default (unprefixed classes = smallest breakpoint), add `sm:`/`md:`/`lg:` overrides as needed:
```tsx
<div className="flex flex-col gap-2 md:flex-row md:gap-4">
```
Every module's pages should be checked at phone width at minimum — this is a personal-use app you'll likely also check on your phone, not just desktop.

## Consistency rule
If you're about to write a one-off spacing/color value that doesn't come from the theme scale, stop and ask whether it should be added to the theme instead — scattered one-off values are how Tailwind codebases drift into visual inconsistency across modules.
