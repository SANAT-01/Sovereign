import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Liquid Glass controls (globals.css): primary is the glossy accent "gel",
// secondary/accent are glass capsules, ghost stays bare until hovered.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "liquid-gel text-surface hover:brightness-110",
  secondary: "liquid-control text-slate-100",
  ghost: "text-slate-300 hover:bg-white/[0.07] hover:text-white",
  // Tinted capsule, distinct from the neutral `secondary` — for a secondary
  // *affirmative* action (e.g. "Open", "Download") that should read as
  // more purposeful than a plain utility action (e.g. "Copy").
  // hover:bg-* re-asserts the tint — .liquid-control:hover's background
  // shorthand would otherwise reset the color on hover.
  accent: "liquid-control border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
};

/**
 * Shared button primitive (ui-dev: component-patterns.md). Fully rounded
 * capsule per visual-style.md, with the springy Liquid Glass press.
 */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`liquid-press inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
