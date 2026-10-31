import { Card } from "../Card";

/**
 * Server-rendered fallback for chart widgets wrapped in <ClientOnly>.
 * Matches each real widget's card shape/height so there's no layout shift
 * when the real chart mounts client-side.
 */
export function ChartSkeleton({ variant = "rect" }: { variant?: "rect" | "circle" }) {
  return (
    <Card variant={variant === "circle" ? "glass" : "solid"} className="p-6">
      <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-white/5" />
      {variant === "circle" ? (
        <div className="mx-auto mt-4 h-32 w-32 animate-pulse rounded-full bg-white/5" />
      ) : (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5" />
      )}
    </Card>
  );
}
