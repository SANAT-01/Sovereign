import { db } from '../../db/client.js';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface NoteListRow {
  id: string;
  title: string;
  content: string;
  updated_at: Date;
}

// List rows still need full `content` here (service.ts strips it down to a
// plain-text snippet) — the point of keeping GET /notes lightweight is not
// shipping full HTML to the *client*, not avoiding reading it from the DB.
export async function listNotes(userId: string): Promise<NoteListRow[]> {
  const result = await db.query<NoteListRow>(
    'SELECT id, title, content, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return result.rows;
}

export async function getNote(userId: string, noteId: string): Promise<Note | null> {
  const result = await db.query<Note>('SELECT * FROM notes WHERE user_id = $1 AND id = $2', [userId, noteId]);
  return result.rows[0] ?? null;
}

export async function createNote(userId: string): Promise<Note> {
  const result = await db.query<Note>(
    `INSERT INTO notes (user_id, title, content) VALUES ($1, '', '') RETURNING *`,
    [userId],
  );
  return result.rows[0];
}

export async function updateNote(
  userId: string,
  noteId: string,
  patch: { title?: string; content?: string },
): Promise<Note | null> {
  const result = await db.query<Note>(
    `UPDATE notes
     SET title = COALESCE($3, title),
         content = COALESCE($4, content),
         updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, noteId, patch.title ?? null, patch.content ?? null],
  );
  return result.rows[0] ?? null;
}

export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM notes WHERE user_id = $1 AND id = $2', [userId, noteId]);
  return (result.rowCount ?? 0) > 0;
}
