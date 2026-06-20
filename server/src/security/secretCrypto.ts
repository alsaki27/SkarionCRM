// server/src/security/secretCrypto.ts
// Encryption helper for admin-managed AI provider keys. Uses Node crypto
// (AES-256-GCM) today. If this server is ever moved to a Workers/edge
// runtime, replace createCipheriv/createDecipheriv with the Web Crypto API
// (crypto.subtle.encrypt/decrypt) using the same algorithm — keep this
// module's exported function signatures unchanged.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.AI_KEYS_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      'AI_KEYS_ENCRYPTION_SECRET is not set. Add it to your environment to enable AI key encryption.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/** Encrypt a plaintext string. Returns hex: iv (16B) + authTag (16B) + ciphertext. */
export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/** Decrypt a hex string produced by encryptSecret. */
export function decryptSecret(encryptedHex: string): string {
  const key = getKey();
  const data = Buffer.from(encryptedHex, 'hex');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Fingerprint for display purposes only (first 6 + last 4 chars). Never reveals the full key. */
export function fingerprintKey(key: string): string {
  if (key.length <= 10) return '****' + key.slice(-4);
  return key.slice(0, 6) + '...' + key.slice(-4);
}

export function isEncryptionAvailable(): boolean {
  return !!process.env.AI_KEYS_ENCRYPTION_SECRET;
}
