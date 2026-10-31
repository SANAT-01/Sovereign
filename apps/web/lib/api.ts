import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:4000";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * SSR-only helper: calls the Express API directly over the internal network
 * (APPROACH.md §6 — no proxy needed server-to-server), forwarding the
 * incoming request's cookies so the session is recognized.
 *
 * Never call this from a Client Component — CSR must go through the
 * Next.js rewrite/proxy instead (see next.config.js).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.user ?? null;
  } catch {
    // Backend unreachable — treat as unauthenticated rather than throwing,
    // so the page can still render (and redirect to /login).
    return null;
  }
}
