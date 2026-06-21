// apps/identity/src/lib/password.ts
// bcryptjs password hashing (pure JavaScript, works in Cloudflare Workers).
// Switched from hash-wasm argon2id because argon2Verify was failing silently
// in the Workers runtime (hash verifies locally but worker rejects it).

import bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Returns a bcrypt hash string, safe to store in users.password_hash. */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

/** Verifies a password against a bcrypt hash. */
export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, encodedHash);
  } catch {
    // Malformed/foreign hash format - treat as a failed verification, not a crash.
    return false;
  }
}
