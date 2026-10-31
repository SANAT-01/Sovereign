import sanitizeHtml from 'sanitize-html';
import { NotFoundError } from '../../errors.js';
import * as repository from './repository.js';

const SNIPPET_LENGTH = 140;

// Rendered back via dangerouslySetInnerHTML (lib/notes-types.ts /
// NotesEditor.tsx) — sanitize on every save, not just on render, so
// stored content is never relied upon to be safe elsewhere.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h2', 'ul', 'ol', 'li', 'blockquote', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

function sanitize(content: string): string {
  return sanitizeHtml(content, SANITIZE_OPTIONS);
}

function snippetOf(content: string): string {
  const text = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH)}…` : text;
}

export async function listNotes(userId: string) {
  const rows = await repository.listNotes(userId);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: snippetOf(row.content),
    updatedAt: row.updated_at,
  }));
}

export async function getNote(userId: string, noteId: string) {
  const note = await repository.getNote(userId, noteId);
  if (!note) throw new NotFoundError('Note not found');
  return note;
}

export async function createNote(userId: string) {
  return repository.createNote(userId);
}

export async function updateNote(userId: string, noteId: string, patch: { title?: string; content?: string }) {
  const updated = await repository.updateNote(userId, noteId, {
    title: patch.title,
    content: patch.content !== undefined ? sanitize(patch.content) : undefined,
  });
  if (!updated) throw new NotFoundError('Note not found');
  return updated;
}

export async function deleteNote(userId: string, noteId: string) {
  const deleted = await repository.deleteNote(userId, noteId);
  if (!deleted) throw new NotFoundError('Note not found');
}
