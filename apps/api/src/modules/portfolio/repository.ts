import { db } from '../../db/client.js';

export type ItemKind = 'link' | 'document' | 'text';

export interface PortfolioSection {
  id: string;
  user_id: string;
  title: string;
  position: number;
  created_at: Date;
}

export interface PortfolioItem {
  id: string;
  user_id: string;
  section_id: string;
  kind: ItemKind;
  label: string;
  value: string | null;
  note: string | null;
  pinned: boolean;
  position: number;
  created_at: Date;
}

// --- Sections ---

export async function listSections(userId: string): Promise<PortfolioSection[]> {
  const result = await db.query<PortfolioSection>(
    'SELECT * FROM portfolio_sections WHERE user_id = $1 ORDER BY position, created_at',
    [userId],
  );
  return result.rows;
}

export async function getSection(userId: string, sectionId: string): Promise<PortfolioSection | null> {
  const result = await db.query<PortfolioSection>(
    'SELECT * FROM portfolio_sections WHERE user_id = $1 AND id = $2',
    [userId, sectionId],
  );
  return result.rows[0] ?? null;
}

export async function createSection(userId: string, title: string): Promise<PortfolioSection> {
  const result = await db.query<PortfolioSection>(
    `INSERT INTO portfolio_sections (user_id, title, position)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM portfolio_sections WHERE user_id = $1))
     RETURNING *`,
    [userId, title],
  );
  return result.rows[0];
}

export async function updateSectionTitle(userId: string, sectionId: string, title: string): Promise<PortfolioSection | null> {
  const result = await db.query<PortfolioSection>(
    'UPDATE portfolio_sections SET title = $3 WHERE user_id = $1 AND id = $2 RETURNING *',
    [userId, sectionId, title],
  );
  return result.rows[0] ?? null;
}

export async function deleteSection(userId: string, sectionId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM portfolio_sections WHERE user_id = $1 AND id = $2', [userId, sectionId]);
  return (result.rowCount ?? 0) > 0;
}

// --- Items ---

export async function listItems(userId: string): Promise<PortfolioItem[]> {
  const result = await db.query<PortfolioItem>(
    'SELECT * FROM portfolio_items WHERE user_id = $1 ORDER BY position, created_at',
    [userId],
  );
  return result.rows;
}

export async function getItem(userId: string, itemId: string): Promise<PortfolioItem | null> {
  const result = await db.query<PortfolioItem>(
    'SELECT * FROM portfolio_items WHERE user_id = $1 AND id = $2',
    [userId, itemId],
  );
  return result.rows[0] ?? null;
}

export async function createItem(
  userId: string,
  data: { sectionId: string; kind: ItemKind; label: string; value?: string | null; note?: string | null },
): Promise<PortfolioItem> {
  const result = await db.query<PortfolioItem>(
    `INSERT INTO portfolio_items (user_id, section_id, kind, label, value, note, position)
     VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(position), -1) + 1 FROM portfolio_items WHERE section_id = $2))
     RETURNING *`,
    [userId, data.sectionId, data.kind, data.label, data.value ?? null, data.note ?? null],
  );
  return result.rows[0];
}

export async function updateItem(
  userId: string,
  itemId: string,
  patch: { label?: string; value?: string | null; note?: string | null; pinned?: boolean },
): Promise<PortfolioItem | null> {
  const result = await db.query<PortfolioItem>(
    `UPDATE portfolio_items
     SET label = COALESCE($3, label),
         value = CASE WHEN $4::boolean THEN $5 ELSE value END,
         note = CASE WHEN $6::boolean THEN $7 ELSE note END,
         pinned = COALESCE($8, pinned)
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [
      userId,
      itemId,
      patch.label ?? null,
      patch.value !== undefined,
      patch.value ?? null,
      patch.note !== undefined,
      patch.note ?? null,
      patch.pinned ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteItem(userId: string, itemId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM portfolio_items WHERE user_id = $1 AND id = $2', [userId, itemId]);
  return (result.rowCount ?? 0) > 0;
}
