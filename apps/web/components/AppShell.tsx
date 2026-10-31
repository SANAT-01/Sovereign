"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./ui/Sidebar";
import { MenuIcon } from "./ui/icons";

/**
 * Wraps every authenticated page (dashboard + module pages) with the
 * sidebar nav from the reference design.
 *
 * Responsive: on lg+ screens, Sidebar renders statically in normal flow
 * (no overlay needed). Below lg, Sidebar becomes an off-canvas drawer
 * (APPROACH.md's ui-dev skill, Sidebar.tsx) — this component owns the
 * open/closed state and renders the mobile header bar (hamburger) plus a
 * dismissible backdrop while the drawer is open.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile-only top bar — hidden on lg+ where the sidebar is always visible. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-surface/80 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-slate-300 hover:text-white"
        >
          <MenuIcon width={22} height={22} />
        </button>
        <span className="text-base font-semibold text-white">Multi Purpose</span>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* pt-14 clears the fixed mobile header; lg:pt-0 since the header is hidden there. */}
      <div className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
