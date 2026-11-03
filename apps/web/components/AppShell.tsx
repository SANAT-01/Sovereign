"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
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
      {/* Floating capsule (top-2 + h-11 = 52px) — still clears the pt-14 below. */}
      <header className="liquid-glass liquid-glass-tint fixed inset-x-3 top-2 z-30 flex h-11 items-center gap-3 rounded-full px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-slate-300 hover:text-white"
        >
          <MenuIcon width={22} height={22} />
        </button>
        <Image src="/logo-mark.png" alt="" width={24} height={24} className="h-6 w-6" />
        <span className="text-base font-semibold text-white">Sovereign</span>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
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
