import { db } from '../../db/client.js';

export interface AvatarUrls {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  intervalMinutes: number;
  lastSentAt: string | null;
}

export interface User {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  avatar_urls: AvatarUrls | null;
  home_widgets: string[];
  progress_chart_prefs: Record<string, string>;
  notification_prefs: NotificationPrefs;
  created_at: Date;
}

// Minimal repository — `users` isn't a feature module in its own right, it's
// the shared identity root other modules' tables reference (data-modeling skill).
export async function findByGoogleSub(googleSub: string): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE google_sub = $1', [googleSub]);
  return result.rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function create(data: {
  googleSub: string;
  email: string;
  displayName?: string | null;
}): Promise<User> {
  const result = await db.query<User>(
    `INSERT INTO users (google_sub, email, display_name)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.googleSub, data.email, data.displayName ?? null],
  );
  return result.rows[0];
}

export async function updateAvatarUrls(id: string, avatarUrls: AvatarUrls): Promise<User> {
  const result = await db.query<User>(
    `UPDATE users SET avatar_urls = $2 WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(avatarUrls)],
  );
  return result.rows[0];
}

export async function updateHomeWidgets(id: string, homeWidgets: string[]): Promise<User> {
  const result = await db.query<User>(
    `UPDATE users SET home_widgets = $2 WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(homeWidgets)],
  );
  return result.rows[0];
}

// Merges into the existing map (jsonb ||) rather than replacing it, so
// changing one chart's type doesn't wipe the others' saved preference.
export async function updateChartPrefs(id: string, patch: Record<string, string>): Promise<User> {
  const result = await db.query<User>(
    `UPDATE users SET progress_chart_prefs = progress_chart_prefs || $2::jsonb WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(patch)],
  );
  return result.rows[0];
}

// Merges into the existing object (jsonb ||), same reasoning as
// updateChartPrefs — e.g. toggling `enabled` from Profile shouldn't
// clobber a saved `intervalMinutes`.
export async function updateNotificationPrefs(
  id: string,
  patch: Partial<NotificationPrefs>,
): Promise<User> {
  const result = await db.query<User>(
    `UPDATE users SET notification_prefs = notification_prefs || $2::jsonb WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(patch)],
  );
  return result.rows[0];
}

// Scoped to exactly what the reminders job needs (id/email/prefs), not the
// full User shape — this runs on a timer outside any request, so it
// shouldn't carry gemini_api_key_encrypted-adjacent risk of over-fetching.
export async function listUsersWithRemindersEnabled(): Promise<
  { id: string; email: string; notification_prefs: NotificationPrefs }[]
> {
  const result = await db.query<{ id: string; email: string; notification_prefs: NotificationPrefs }>(
    `SELECT id, email, notification_prefs FROM users WHERE notification_prefs->>'enabled' = 'true'`,
  );
  return result.rows;
}

// Deliberately NOT part of the `User` interface/`SELECT *` shape above —
// the encrypted key is only ever fetched by this one narrow query
// (assistant/service.ts), never attached to the general User object that
// flows through req.user, so there's no row at all for an accidental
// `res.json({ user })` to leak (APPROACH.md §19).
export async function setGeminiApiKeyEncrypted(id: string, encrypted: string | null): Promise<void> {
  await db.query('UPDATE users SET gemini_api_key_encrypted = $2 WHERE id = $1', [id, encrypted]);
}

export async function getGeminiApiKeyEncrypted(id: string): Promise<string | null> {
  const result = await db.query<{ gemini_api_key_encrypted: string | null }>(
    'SELECT gemini_api_key_encrypted FROM users WHERE id = $1',
    [id],
  );
  return result.rows[0]?.gemini_api_key_encrypted ?? null;
}

export async function hasGeminiApiKey(id: string): Promise<boolean> {
  const result = await db.query<{ has_key: boolean }>(
    'SELECT gemini_api_key_encrypted IS NOT NULL AS has_key FROM users WHERE id = $1',
    [id],
  );
  return result.rows[0]?.has_key ?? false;
}
