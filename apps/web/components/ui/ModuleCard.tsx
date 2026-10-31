import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./Card";

interface ModuleCardProps {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  className?: string;
}

/**
 * Bento-grid tile for the dashboard's module switcher (visual-style.md:
 * icon-forward card, teal accent icon chip, generous padding).
 */
export function ModuleCard({ href, label, description, icon, className = "" }: ModuleCardProps) {
  return (
    <Link href={href} className={`group block ${className}`}>
      <Card className="h-full p-6 transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/20">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{label}</h3>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
