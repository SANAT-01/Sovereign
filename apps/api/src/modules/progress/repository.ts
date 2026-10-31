import { db } from '../../db/client.js';

// 'daily' | 'study_plan' | 'interview' get dedicated widgets (service.ts);
// any other string is a user-defined category, rendered with the same
// generic widget as 'other' (ItemCard.tsx's fallback branch) and grouped
// into its own section by that exact string (ProgressBoard.tsx) — "saved
// in the db" simply by being a real item's `type` value, no separate
// categories table needed (APPROACH.md §10's "only 1-2 tables" constraint).
export type ItemType = string;
export type ItemStatus = 'active' | 'done' | 'cancelled';

export interface ProgressItem {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  due_at: Date | null;
  last_activity_at: Date;
  data: Record<string, unknown>;
  created_at: Date;
}

export async function listItems(userId: string): Promise<ProgressItem[]> {
  const result = await db.query<ProgressItem>(
    'SELECT * FROM progress_items WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return result.rows;
}

export async function listItemsByType(userId: string, type: ItemType): Promise<ProgressItem[]> {
  const result = await db.query<ProgressItem>(
    'SELECT * FROM progress_items WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC',
    [userId, type],
  );
  return result.rows;
}

export async function getItem(userId: string, itemId: string): Promise<ProgressItem | null> {
  const result = await db.query<ProgressItem>(
    'SELECT * FROM progress_items WHERE user_id = $1 AND id = $2',
    [userId, itemId],
  );
  return result.rows[0] ?? null;
}

export async function createItem(
  userId: string,
  data: { type: ItemType; title: string; dueAt?: string | null; data?: Record<string, unknown> },
): Promise<ProgressItem> {
  const result = await db.query<ProgressItem>(
    `INSERT INTO progress_items (user_id, type, title, due_at, data)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, data.type, data.title, data.dueAt ?? null, JSON.stringify(data.data ?? {})],
  );
  return result.rows[0];
}

// Generic update — any subset of fields; `data` is merged (not replaced)
// into the existing JSONB, so callers only need to pass the keys they're
// changing, not the whole payload.
export async function updateItem(
  userId: string,
  itemId: string,
  patch: { title?: string; status?: ItemStatus; dueAt?: string | null; dataPatch?: Record<string, unknown> },
): Promise<ProgressItem | null> {
  const result = await db.query<ProgressItem>(
    `UPDATE progress_items
     SET title = COALESCE($3, title),
         status = COALESCE($4, status),
         due_at = CASE WHEN $5::boolean THEN $6 ELSE due_at END,
         data = data || $7::jsonb,
         last_activity_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [
      userId,
      itemId,
      patch.title ?? null,
      patch.status ?? null,
      patch.dueAt !== undefined, // explicit flag — dueAt can legitimately be set to null
      patch.dueAt ?? null,
      JSON.stringify(patch.dataPatch ?? {}),
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteItem(userId: string, itemId: string): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM progress_items WHERE user_id = $1 AND id = $2',
    [userId, itemId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Generic daily-completion log (APPROACH.md §10) ---

// One grouped query across every daily item's logs, rather than N
// per-item queries — used by the charts endpoint (service.ts's
// getChartData), which aggregates across all daily items at once.
export async function getLogCountsByDate(
  userId: string,
  itemIds: string[],
  days: number,
): Promise<{ log_date: string; count: number }[]> {
  if (itemIds.length === 0) return [];
  const result = await db.query<{ log_date: string; count: number }>(
    `SELECT log_date::text, COUNT(*)::int AS count
     FROM progress_item_logs
     WHERE user_id = $1 AND item_id = ANY($2) AND log_date >= CURRENT_DATE - ($3 || ' days')::interval
     GROUP BY log_date
     ORDER BY log_date`,
    [userId, itemIds, days - 1],
  );
  return result.rows;
}

export async function getItemLogDates(userId: string, itemId: string): Promise<string[]> {
  const result = await db.query<{ log_date: string }>(
    `SELECT log_date::text FROM progress_item_logs
     WHERE user_id = $1 AND item_id = $2 AND log_date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY log_date`,
    [userId, itemId],
  );
  return result.rows.map((r) => r.log_date);
}

export async function logItemToday(userId: string, itemId: string): Promise<void> {
  await db.query(
    `INSERT INTO progress_item_logs (user_id, item_id, log_date)
     VALUES ($1, $2, CURRENT_DATE)
     ON CONFLICT (item_id, log_date) DO NOTHING`,
    [userId, itemId],
  );
}

export async function unlogItemToday(userId: string, itemId: string): Promise<void> {
  await db.query(
    `DELETE FROM progress_item_logs WHERE user_id = $1 AND item_id = $2 AND log_date = CURRENT_DATE`,
    [userId, itemId],
  );
}

// --- Dashboard queries — generic across every type (APPROACH.md §10) ---

export async function listStaleItems(userId: string, staleDays: number): Promise<ProgressItem[]> {
  const result = await db.query<ProgressItem>(
    `SELECT * FROM progress_items
     WHERE user_id = $1 AND status = 'active'
       AND last_activity_at < now() - ($2 || ' days')::interval
     ORDER BY last_activity_at
     LIMIT 10`,
    [userId, staleDays],
  );
  return result.rows;
}

// Only genuinely upcoming items — a due_at in the past is "overdue," not
// "coming up," and belongs in the stale bucket instead (it'll surface
// there once last_activity_at falls behind, rather than lingering here
// forever just because it's still <= now() + N days).
export async function listDueSoonItems(userId: string, withinDays: number): Promise<ProgressItem[]> {
  const result = await db.query<ProgressItem>(
    `SELECT * FROM progress_items
     WHERE user_id = $1 AND status = 'active' AND due_at IS NOT NULL
       AND due_at BETWEEN now() AND now() + ($2 || ' days')::interval
     ORDER BY due_at`,
    [userId, withinDays],
  );
  return result.rows;
}
