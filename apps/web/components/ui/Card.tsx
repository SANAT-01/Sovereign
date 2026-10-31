import type { ReactNode } from "react";

type CardVariant = "glass" | "solid";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  // bg-white/10 + backdrop-blur per visual-style.md's glass card recipe.
  glass: "bg-white/[0.06] border border-white/10 backdrop-blur-xl",
  // Solid dark-teal cards, used for the primary/"on" widgets.
  solid: "bg-surface-card/80 border border-white/5 backdrop-blur",
};

/**
 * Shared glass-card primitive (ui-dev: component-patterns.md). Pure
 * presentation — no business logic, no data fetching. Pages compose this
 * with their own content.
 */
export function Card({ children, className = "", variant = "glass" }: CardProps) {
  return (
    <div
      className={`rounded-3xl shadow-lg shadow-black/20 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
