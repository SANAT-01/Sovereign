import sharp from 'sharp';
import { ValidationError } from '../../errors';
import { uploadPublicFile } from '../../lib/storage';
import * as usersRepository from '../users/repository';
import type { User, AvatarUrls } from '../users/repository';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — cap on the original upload.

// Fixed pixel sizes per variant — generated once per upload from the
// original buffer (not resized-from-resized, which would compound quality
// loss), so callers pick the variant matching where it's displayed instead
// of one fixed size serving every context (sidebar thumbnail vs. profile
// page preview vs. a future larger view).
const VARIANT_SIZES: Record<keyof AvatarUrls, number> = {
  thumbnail: 48,
  small: 96,
  medium: 256,
  large: 512,
};

// Module keys that currently have a real home-screen summary to show.
// Keeps the home screen from offering a toggle for a module that would
// just show fabricated/placeholder data (APPROACH.md §10 applies the same
// "don't fabricate" rule to home widgets as to the progress dashboard).
const AVAILABLE_WIDGETS = new Set(['progress']);

export async function getProfile(userId: string): Promise<User | null> {
  return usersRepository.findById(userId);
}

export async function updateHomeWidgets(userId: string, widgets: string[]): Promise<User> {
  const invalid = widgets.filter((w) => !AVAILABLE_WIDGETS.has(w));
  if (invalid.length > 0) {
    throw new ValidationError(`Unknown widget(s): ${invalid.join(', ')}`);
  }
  return usersRepository.updateHomeWidgets(userId, widgets);
}

export async function uploadAvatar(
  userId: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<User> {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new ValidationError('Avatar must be a JPEG, PNG, or WebP image');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ValidationError('Avatar must be 5MB or smaller');
  }

  const variantEntries = await Promise.all(
    (Object.entries(VARIANT_SIZES) as [keyof AvatarUrls, number][]).map(
      async ([variant, size]) => {
        const resized = await sharp(file.buffer)
          .resize(size, size, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer();

        // Namespaced by user id and variant (APPROACH.md §8) — overwrites
        // any previous avatar for this user/variant rather than
        // accumulating orphaned objects.
        const objectName = `avatars/${userId}/${variant}.webp`;
        const url = await uploadPublicFile(objectName, resized, 'image/webp');
        return [variant, url] as const;
      },
    ),
  );

  const avatarUrls = Object.fromEntries(variantEntries) as AvatarUrls;
  return usersRepository.updateAvatarUrls(userId, avatarUrls);
}
