import type { ReactNode } from "react";

type CardVariant = "glass" | "solid";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  // More see-through glass: lower fill opacity + stronger blur so the page
  // background shows through more, per visual-style.md's glass recipe.
  glass: "bg-white/[0.035] border border-white/15 backdrop-blur-2xl",
  // Solid dark-teal cards stay a bit more opaque (they're the "primary/on"
  // widgets) but still noticeably translucent, not flat.
  solid: "bg-surface-card/55 border border-white/10 backdrop-blur-xl",
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
