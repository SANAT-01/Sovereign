import { Card } from "@/components/ui/Card";
import { GoogleIcon } from "@/components/ui/icons";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Multi Purpose</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to access your expenses, notes, progress tracker, and portfolio.
        </p>

        {/*
          Real <a> tag, full navigation — OAuth needs an actual browser
          redirect, not a fetch (fe-dev). /auth/google is proxied to the
          backend by the rewrite in next.config.js.
        */}
        <a
          href="/auth/google"
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-900 transition-colors duration-200 hover:bg-slate-100"
        >
          <GoogleIcon />
          Sign in with Google
        </a>
      </Card>
    </main>
  );
}
