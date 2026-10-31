import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-surface hover:bg-accent-dim",
  secondary: "bg-white/10 text-slate-100 hover:bg-white/20 border border-white/10",
  ghost: "text-slate-300 hover:text-white hover:bg-white/5",
  // Tinted pill, distinct from the neutral `secondary` — for a secondary
  // *affirmative* action (e.g. "Open", "Download") that should read as
  // more purposeful than a plain utility action (e.g. "Copy").
  accent: "bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20",
};

/**
 * Shared button primitive (ui-dev: component-patterns.md). Fully rounded
 * per visual-style.md ("pill" shape for buttons/toggles).
 */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
