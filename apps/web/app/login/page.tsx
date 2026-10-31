import { Card } from "@/components/ui/Card";
import {
  GoogleIcon,
  WalletIcon,
  NotesIcon,
  TargetIcon,
  BriefcaseIcon,
} from "@/components/ui/icons";

const features = [
  { label: "Expenses", icon: WalletIcon },
  { label: "Notes", icon: NotesIcon },
  { label: "Progress", icon: TargetIcon },
  { label: "Portfolio", icon: BriefcaseIcon },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-xl font-semibold text-accent">
          MP
        </div>

        <h1 className="mt-5 text-xl font-semibold text-white">Multi Purpose</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your expenses, notes, progress, and portfolio — one account, one place.
        </p>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {features.map(({ label, icon: FeatureIcon }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-slate-500">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300">
                <FeatureIcon width={16} height={16} />
              </div>
              <span className="text-[11px]">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 h-px w-full bg-white/10" />

        {/*
          Real <a> tag, full navigation — OAuth needs an actual browser
          redirect, not a fetch (fe-dev). /auth/google is proxied to the
          backend by the rewrite in next.config.js.
        */}
        <a
          href="/auth/google"
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-lg shadow-black/20 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-slate-100"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <p className="mt-4 text-[11px] text-slate-500">
          No password needed — your Google account is the only sign-in method.
        </p>
      </Card>
    </main>
  );
}
