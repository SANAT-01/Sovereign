import type { Metadata } from "next";
import { LiquidPointer } from "@/components/ui/LiquidPointer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sovereign",
  description: "Personal expense tracker, notes, progress tracker, and portfolio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning here only ignores attribute diffs browser
    // extensions inject into <html>/<body> before React hydrates (a
    // documented false-positive source, not a mask for a real mismatch
    // elsewhere in the tree — see next-best-practices/hydration-error.md).
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Slow-drifting color orbs behind every page — Liquid Glass panels
            (globals.css) need moving color underneath, or their
            blur/saturation has nothing to bend. Decorative only; frozen
            under reduced motion. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 top-10 h-80 w-80 animate-drift rounded-full bg-accent/[0.12] blur-3xl motion-reduce:animate-none" />
          <div className="absolute right-[-6rem] top-1/3 h-96 w-96 animate-drift-slow rounded-full bg-indigo-400/10 blur-3xl motion-reduce:animate-none" />
          <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 animate-drift rounded-full bg-rose-400/[0.05] blur-3xl motion-reduce:animate-none" />
        </div>
        <LiquidPointer />
        {children}
      </body>
    </html>
  );
}
