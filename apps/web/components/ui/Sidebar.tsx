"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import {
  HomeIcon,
  WalletIcon,
  NotesIcon,
  TargetIcon,
  BriefcaseIcon,
  UserIcon,
  CloseIcon,
} from "./icons";

const navItems = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/expenses", label: "Expenses", icon: WalletIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
  { href: "/progress", label: "Progress", icon: TargetIcon },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

/**
 * Sidebar nav with pill-shaped active state — the module switcher pattern
 * from ui-dev's visual-style.md, glass theme.
 *
 * Responsive: static/always-visible on lg+ screens (desktop). Below that,
 * it's an off-canvas drawer — fixed, translated off-screen by default,
 * toggled by AppShell's mobile header. A full-width always-visible sidebar
 * would otherwise eat most of a phone's viewport.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-white/15 bg-white/[0.025] px-4 py-6 backdrop-blur-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <span className="text-lg font-semibold text-white">Multi Purpose</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-slate-400 hover:text-white lg:hidden"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: ItemIcon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <ItemIcon width={18} height={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <SignOutButton />
    </aside>
  );
}
