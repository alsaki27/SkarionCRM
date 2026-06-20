// apps/identity/src/lib/password.ts
// argon2id password hashing via hash-wasm (WASM, runs on Workers - bcrypt's
// native bindings don't). Params per spec: memory 19MB, time cost 2,
// parallelism 1 - tuned for Workers' CPU budget. First call per isolate pays
// ~80ms WASM init; subsequent calls in the same isolate are fast. Documented
// as an accepted tradeoff (see risks/notes in the chunk 1 spec).

import { argon2id, argon2Verify } from 'hash-wasm';

const MEMORY_SIZE_KIB = 19 * 1024; // 19 MB
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/** Returns a PHC-encoded argon2id hash string, safe to store in users.password_hash. */
export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomSalt(),
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_SIZE_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });
}

/** Verifies a password against a PHC-encoded argon2id hash. */
export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: encodedHash });
  } catch {
    // Malformed/foreign hash format - treat as a failed verification, not a crash.
    return false;
  }
}
