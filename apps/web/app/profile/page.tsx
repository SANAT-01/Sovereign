import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { AvatarUploadForm } from "@/components/AvatarUploadForm";
import { NotificationPrefsForm } from "@/components/NotificationPrefsForm";
import { getCurrentUser, ssrGet } from "@/lib/api";

interface NotificationPrefs {
  enabled: boolean;
  intervalMinutes: number;
  lastSentAt: string | null;
}

interface ProfileResponse {
  user: { notification_prefs: NotificationPrefs } | null;
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: false, intervalMinutes: 1440, lastSentAt: null };

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
          <p className="text-sm font-medium text-accent">Reminders</p>
          <p className="mt-1 text-xs text-slate-400">
            Email digest of what&rsquo;s due soon or gone stale on your Progress Tracker dashboard, sent to{" "}
            {user.email}.
          </p>
          <div className="mt-4">
            <NotificationPrefsForm initialPrefs={profile?.user?.notification_prefs ?? DEFAULT_PREFS} />
          </div>
        </Card>
      </main>
    </AppShell>
  );
}
