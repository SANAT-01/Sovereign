import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Encrypts secrets a user pastes in (their own LLM API key — APPROACH.md
// §19) before they ever touch the database. Deliberately a separate
// secret from SESSION_SECRET — different purpose, so a leak of one
// doesn't also compromise the other.
// Validated lazily (on first actual use, not at import time) so the whole
// API doesn't fail to boot over a feature-specific env var that a
// deployment not yet using the assistant hasn't set.
function getKey(): Buffer {
  const keyHex = process.env.CHAT_KEY_ENCRYPTION_SECRET;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('CHAT_KEY_ENCRYPTION_SECRET must be a 64-character hex string (openssl rand -hex 32)');
  }
  return Buffer.from(keyHex, 'hex');
}

// iv:authTag:ciphertext, each base64 — one self-contained string per
// stored secret, same shape every time, easy to store in one TEXT column.
export function encryptSecret(plaintext: string): string {
  const KEY = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(stored: string): string {
  const KEY = getKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
