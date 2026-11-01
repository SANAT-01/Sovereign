import sharp from 'sharp';
import { ValidationError } from '../../errors.js';
import { uploadPublicFile } from '../../lib/storage.js';
import { encryptSecret } from '../../lib/crypto.js';
import { MIN_PROD_INTERVAL_MINUTES } from '../../jobs/reminders.js';
import * as usersRepository from '../users/repository.js';
import type { User, AvatarUrls, NotificationPrefs } from '../users/repository.js';

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

// Explicit whitelist, not a spread-and-delete — `SELECT *` on the users
// table also returns gemini_api_key_encrypted (APPROACH.md §19), which
// must never reach a response. Rebuilding the object field-by-field means
// a future column added to the table is excluded by default, not leaked
// by default.
function toPublicUser(user: User): User {
  return {
    id: user.id,
    google_sub: user.google_sub,
    email: user.email,
    display_name: user.display_name,
    avatar_urls: user.avatar_urls,
    home_widgets: user.home_widgets,
    progress_chart_prefs: user.progress_chart_prefs,
    notification_prefs: user.notification_prefs,
    created_at: user.created_at,
  };
}

export async function getProfile(userId: string) {
  const user = await usersRepository.findById(userId);
  if (!user) return { user: null, hasGeminiApiKey: false };
  const hasGeminiApiKey = await usersRepository.hasGeminiApiKey(userId);
  return { user: toPublicUser(user), hasGeminiApiKey };
}

export async function updateHomeWidgets(userId: string, widgets: string[]): Promise<User> {
  const invalid = widgets.filter((w) => !AVAILABLE_WIDGETS.has(w));
  if (invalid.length > 0) {
    throw new ValidationError(`Unknown widget(s): ${invalid.join(', ')}`);
  }
  const user = await usersRepository.updateHomeWidgets(userId, widgets);
  return toPublicUser(user);
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

  const avatarUrls = Object.fromEntries(variantEntries) as unknown as AvatarUrls;
  const user = await usersRepository.updateAvatarUrls(userId, avatarUrls);
  return toPublicUser(user);
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<User> {
  if (patch.intervalMinutes !== undefined) {
    if (!Number.isInteger(patch.intervalMinutes) || patch.intervalMinutes < 1) {
      throw new ValidationError('intervalMinutes must be a positive integer');
    }
    // Enforced here too (not just at send time in jobs/reminders.ts) so a
    // saved value in production never even looks like it accepted
    // something shorter than the floor (APPROACH.md §21).
    if (process.env.NODE_ENV === 'production' && patch.intervalMinutes < MIN_PROD_INTERVAL_MINUTES) {
      throw new ValidationError(`intervalMinutes must be at least ${MIN_PROD_INTERVAL_MINUTES} in production`);
    }
  }
  const user = await usersRepository.updateNotificationPrefs(userId, patch);
  return toPublicUser(user);
}

export async function setGeminiApiKey(userId: string, apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new ValidationError('API key is required');
  await usersRepository.setGeminiApiKeyEncrypted(userId, encryptSecret(apiKey.trim()));
}

export async function clearGeminiApiKey(userId: string): Promise<void> {
  await usersRepository.setGeminiApiKeyEncrypted(userId, null);
}
