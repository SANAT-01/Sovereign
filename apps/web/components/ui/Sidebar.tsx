"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import {
  BriefcaseIcon,
  ChatIcon,
  CloseIcon,
  FileIcon,
  HomeIcon,
  NotesIcon,
  TargetIcon,
  UserIcon,
  WalletIcon,
} from "./icons";

const navItems = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/expenses", label: "Expenses", icon: WalletIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
  { href: "/progress", label: "Progress", icon: TargetIcon },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseIcon },
  { href: "/assistant", label: "Assistant", icon: ChatIcon },
  { href: "/resume", label: "Resume", icon: FileIcon },
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
    // Floating Liquid Glass panel: an off-canvas drawer below lg, and on lg+
    // a sticky panel inset from the viewport edges (iPadOS-style floating
    // sidebar). lg:transform-none matters — a transformed ancestor breaks
    // the `background-attachment: fixed` pointer highlight in Chromium.
    <aside
      className={`liquid-glass liquid-glass-tint fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col justify-between rounded-r-3xl px-3 py-6 transition-transform duration-300 ease-out lg:sticky lg:top-3 lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-3xl lg:transform-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
            <span className="text-lg font-semibold text-white">Sovereign</span>
          </div>
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
                aria-current={active ? "page" : undefined}
                className={`liquid-press flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-medium ${
                  active
                    ? "liquid-control text-accent"
                    : "border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
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
