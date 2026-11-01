const CATEGORY_LABELS: Record<string, string> = {
  daily: "Daily Habit",
  study_plan: "Study Plan",
  interview: "Interview",
  other: "Other",
};
function categoryLabel(type: string): string {
  return CATEGORY_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

function formatDueDate(dueAt: string): string {
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A single "needs attention" row — replaces the old bare `<li>⚠️ "title"</li>`
 * text with enough context to actually know what the item is about without
 * clicking into it: category, description, and due date, alongside the
 * reason it's listed at all.
 */
export function AttentionRow({
  icon,
  title,
  reason,
  category,
  description,
  dueAt,
}: {
  icon: string;
  title: string;
  reason: string;
  category?: string;
  description?: string;
  dueAt?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-white">{title}</p>
          {category && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {categoryLabel(category)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{reason}</p>
        {description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{description}</p>}
      </div>
      {dueAt && (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">
          {formatDueDate(dueAt)}
        </span>
      )}
    </div>
  );
}
