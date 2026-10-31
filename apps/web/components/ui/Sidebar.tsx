"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { HomeIcon, WalletIcon, NotesIcon, TargetIcon, BriefcaseIcon } from "./icons";

const navItems = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/expenses", label: "Expenses", icon: WalletIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
  { href: "/progress", label: "Progress", icon: TargetIcon },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseIcon },
];

/**
 * Sidebar nav with pill-shaped active state — the module switcher pattern
 * from ui-dev's visual-style.md, glass theme (final decision).
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-white/[0.04] px-4 py-6 backdrop-blur-xl">
      <div>
        <div className="px-2 pb-6 text-lg font-semibold text-white">Multi Purpose</div>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: ItemIcon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
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
