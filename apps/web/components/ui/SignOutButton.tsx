"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";

/**
 * CSR-via-proxy per fe-dev: posts to the same-origin Route Handler at
 * /api/auth/logout, which forwards to the backend's /auth/logout.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" onClick={handleSignOut} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
