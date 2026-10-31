// Mirrors apps/api/src/modules/notes (APPROACH.md §18) — a note is just
// title + rich-text HTML content, no generic items model needed.

export interface NoteListItem {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  created_at: string;
}
