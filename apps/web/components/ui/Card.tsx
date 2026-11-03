import type { ReactNode } from "react";

type CardVariant = "glass" | "solid";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}

// Both variants are Liquid Glass (globals.css) — `glass` is clear,
// `solid` is the teal-tinted "primary" panel. Callers must not add
// Tailwind `shadow-*`/`ring-*` utilities: both are box-shadows and would
// replace the glass's inset rim highlights. Use a `border-*` color instead.
const variantClasses: Record<CardVariant, string> = {
  glass: "liquid-glass",
  solid: "liquid-glass liquid-glass-tint",
};

/**
 * Shared glass-card primitive (ui-dev: component-patterns.md). Pure
 * presentation — no business logic, no data fetching. Pages compose this
 * with their own content.
 */
export function Card({ children, className = "", variant = "glass" }: CardProps) {
  return (
    <div
      className={`rounded-3xl ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
