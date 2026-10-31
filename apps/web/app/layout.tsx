import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi Purpose",
  description: "Personal expense tracker, notes, progress tracker, and portfolio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning here only ignores attribute diffs browser
    // extensions inject into <html>/<body> before React hydrates (a
    // documented false-positive source, not a mask for a real mismatch
    // elsewhere in the tree — see next-best-practices/hydration-error.md).
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
