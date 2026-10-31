import { ValidationError, NotFoundError } from '../../errors.js';
import { uploadPublicFile } from '../../lib/storage.js';
import * as repository from './repository.js';
import type { ItemKind } from './repository.js';

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function assertNonEmpty(value: string, message: string) {
  if (!value.trim()) throw new ValidationError(message);
}

// --- Sections ---

export async function getBoard(userId: string) {
  const [sections, items] = await Promise.all([repository.listSections(userId), repository.listItems(userId)]);
  return sections.map((section) => ({
    ...section,
    items: items.filter((item) => item.section_id === section.id),
  }));
}

export async function createSection(userId: string, title: string) {
  assertNonEmpty(title, 'Section title is required');
  return repository.createSection(userId, title.trim());
}

export async function renameSection(userId: string, sectionId: string, title: string) {
  assertNonEmpty(title, 'Section title is required');
  const section = await repository.updateSectionTitle(userId, sectionId, title.trim());
  if (!section) throw new NotFoundError('Section not found');
  return section;
}

export async function deleteSection(userId: string, sectionId: string) {
  const deleted = await repository.deleteSection(userId, sectionId);
  if (!deleted) throw new NotFoundError('Section not found');
}

// --- Items ---

async function assertSectionOwned(userId: string, sectionId: string) {
  const section = await repository.getSection(userId, sectionId);
  if (!section) throw new NotFoundError('Section not found');
}

export async function createItem(
  userId: string,
  input: { sectionId: string; kind: ItemKind; label: string; value?: string; note?: string },
) {
  assertNonEmpty(input.label, 'Label is required');
  if (!['link', 'document', 'text'].includes(input.kind)) {
    throw new ValidationError('Invalid item kind');
  }
  await assertSectionOwned(userId, input.sectionId);

  if (input.kind === 'link' && input.value?.trim()) {
    try {
      new URL(input.value.trim());
    } catch {
      throw new ValidationError('Link must be a valid URL');
    }
  }

  return repository.createItem(userId, {
    sectionId: input.sectionId,
    kind: input.kind,
    label: input.label.trim(),
    value: input.value?.trim(),
    note: input.note?.trim(),
  });
}

export async function uploadDocument(
  userId: string,
  input: { sectionId: string; label: string; file: { buffer: Buffer; mimetype: string; size: number; originalname: string } },
) {
  assertNonEmpty(input.label, 'Label is required');
  await assertSectionOwned(userId, input.sectionId);

  if (!ALLOWED_DOCUMENT_TYPES.has(input.file.mimetype)) {
    throw new ValidationError('Document must be a PDF, Word doc, PNG, or JPEG');
  }
  if (input.file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ValidationError('Document must be 10MB or smaller');
  }

  // Created first so the upload's object path (namespaced by item id,
  // same pattern as avatar variants — APPROACH.md §8) is stable and
  // never collides with a previous document at this item.
  const item = await repository.createItem(userId, {
    sectionId: input.sectionId,
    kind: 'document',
    label: input.label.trim(),
  });

  const objectName = `portfolio/${userId}/${item.id}/${input.file.originalname}`;
  const url = await uploadPublicFile(objectName, input.file.buffer, input.file.mimetype);
  const sizeKb = Math.round(input.file.size / 1024);
  const note = `${sizeKb} KB · uploaded ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const updated = await repository.updateItem(userId, item.id, { value: url, note });
  return updated!;
}

export async function editItem(
  userId: string,
  itemId: string,
  patch: { label?: string; value?: string; note?: string; pinned?: boolean },
) {
  if (patch.label !== undefined) assertNonEmpty(patch.label, 'Label cannot be empty');
  const item = await repository.getItem(userId, itemId);
  if (!item) throw new NotFoundError('Item not found');

  if (item.kind === 'link' && patch.value !== undefined && patch.value.trim()) {
    try {
      new URL(patch.value.trim());
    } catch {
      throw new ValidationError('Link must be a valid URL');
    }
  }

  const updated = await repository.updateItem(userId, itemId, {
    label: patch.label?.trim(),
    value: patch.value?.trim(),
    note: patch.note?.trim(),
    pinned: patch.pinned,
  });
  return updated!;
}

export async function deleteItem(userId: string, itemId: string) {
  const deleted = await repository.deleteItem(userId, itemId);
  if (!deleted) throw new NotFoundError('Item not found');
}
