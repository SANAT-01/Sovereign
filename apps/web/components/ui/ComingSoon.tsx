import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./Card";

interface ComingSoonProps {
  label: string;
  icon: ReactNode;
}

/**
 * Shared placeholder for module pages not yet built out
 * (this scaffolding pass is shell-only, per the task scope).
 */
export function ComingSoon({ label, icon }: ComingSoonProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      <Card className="w-full max-w-lg p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          {icon}
        </div>
        <h1 className="mt-6 text-xl font-semibold text-white">{label}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Coming soon — this module will be built in a later phase.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm font-medium text-accent hover:text-accent-dim"
        >
          ← Back to dashboard
        </Link>
      </Card>
    </main>
  );
}
