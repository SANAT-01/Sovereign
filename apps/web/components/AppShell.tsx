import type { ReactNode } from "react";
import { Sidebar } from "./ui/Sidebar";

/**
 * Wraps every authenticated page (dashboard + module pages) with the
 * sidebar nav from the reference design. Server Component — the sidebar
 * itself is the only client-interactive piece inside it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
