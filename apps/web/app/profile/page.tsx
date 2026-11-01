import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { AvatarUploadForm } from "@/components/AvatarUploadForm";
import { GeminiApiKeyForm } from "@/components/GeminiApiKeyForm";
import { getCurrentUser, ssrGet } from "@/lib/api";

interface ProfileResponse {
  hasGeminiApiKey: boolean;
}

export default async function ProfilePage() {
  // Same SSR auth pattern as the dashboard (APPROACH.md §6) — direct
  // server-to-server call to the backend, no proxy needed.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await ssrGet<ProfileResponse>("/profile");

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <p className="text-sm text-slate-400">Account</p>
        <h1 className="text-2xl font-semibold text-white">Profile</h1>

        <Card variant="glass" className="mt-6 p-6">
          <p className="text-sm font-medium text-accent">Profile photo</p>
          <div className="mt-4">
            <AvatarUploadForm user={user} />
          </div>
        </Card>

        <Card variant="glass" className="mt-4 p-6">
          <p className="text-sm font-medium text-accent">Account details</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Name</dt>
              <dd className="text-white">{user.displayName || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Email</dt>
              <dd className="text-white">{user.email}</dd>
            </div>
          </dl>
        </Card>

        <Card variant="glass" className="mt-4 p-6">
          <p className="text-sm font-medium text-accent">Assistant (Gemini API key)</p>
          <p className="mt-1 text-xs text-slate-400">
            Your own Gemini API key, used only to answer your questions on the Assistant page — never shown again
            once saved, and never used for anything but your own requests.
          </p>
          <div className="mt-4">
            <GeminiApiKeyForm initialHasKey={profile?.hasGeminiApiKey ?? false} />
          </div>
        </Card>
      </main>
    </AppShell>
  );
}
