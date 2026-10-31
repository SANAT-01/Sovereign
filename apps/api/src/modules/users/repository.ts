import { db } from '../../db/client';

export interface AvatarUrls {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
}

export interface User {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  avatar_urls: AvatarUrls | null;
  home_widgets: string[];
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
