"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Deliberate client-only display boundary (next-best-practices:
 * hydration-error.md) — the server HTML holds only `fallback`, and real
 * content mounts after hydration. Used for Recharts widgets, whose
 * internal clipPath/gradient ids use a global counter that isn't
 * guaranteed to match between server and client renders when multiple
 * chart instances are on one page — not something our own code controls,
 * so SSR-ing them is the actual mismatch source, not a code bug to fix.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
