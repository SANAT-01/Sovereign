"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import type { SessionUser } from "@/lib/api";

/**
 * CSR upload per fe-dev: posts multipart form data to the same-origin
 * /api/profile/avatar, which next.config.js's rewrite forwards to the
 * internal Express API (/profile/avatar) — the browser never talks to
 * MinIO or Express directly (APPROACH.md §6, §8).
 */
export function AvatarUploadForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // "medium" (256px source) gives good headroom for the 80px display slot
  // below, including retina displays.
  const [preview, setPreview] = useState<string | null>(user.avatarUrls?.medium ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreview(URL.createObjectURL(file)); // instant local preview while uploading
    setUploading(true);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Upload failed");
      }
      setPreview(data.user.avatar_urls.medium);
      router.refresh(); // picks up the new avatar in the sidebar/dashboard (SSR)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(user.avatarUrls?.medium ?? null); // revert preview on failure
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- external MinIO URL / object URL preview, not a static asset
        <img
          src={preview}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-full border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent">
          {(user.displayName || user.email).charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Change photo"}
        </Button>
        <p className="mt-2 text-xs text-slate-400">JPEG, PNG, or WebP. Up to 5MB.</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
