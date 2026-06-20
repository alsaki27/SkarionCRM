// apps/identity/src/lib/totp.ts
// Hand-rolled RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s step) using Web Crypto
// only - no dependency. Compatible with Google Authenticator, Authy, 1Password,
// etc. (the standard everyone's authenticator app already implements).

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

export function generateBase32Secret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export function buildProvisioningUri(params: {
  secretBase32: string;
  accountEmail: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountEmail}`);
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Verifies a 6-digit TOTP code, allowing ±1 time step for clock drift. */
export async function verifyTotpCode(
  secretBase32: string,
  code: string,
  atTimeMs: number = Date.now()
): Promise<boolean> {
  const counter = Math.floor(atTimeMs / 1000 / PERIOD_SECONDS);
  for (const drift of [0, -1, 1]) {
    const expected = await computeTotp(secretBase32, counter + drift);
    if (expected === code) return true;
  }
  return false;
}

async function computeTotp(secretBase32: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const counterBytes = new ArrayBuffer(8);
  new DataView(counterBytes).setBigUint64(0, BigInt(counter), false);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));

  // HMAC-SHA1 output is always 20 bytes and offset is a 4-bit value (0-15),
  // so offset+3 (<=18) is always in bounds - safe to assert non-null here.
  const offset = signature[signature.length - 1]! & 0xf;
  const binCode =
    ((signature[offset]! & 0x7f) << 24) |
    ((signature[offset + 1]! & 0xff) << 16) |
    ((signature[offset + 2]! & 0xff) << 8) |
    (signature[offset + 3]! & 0xff);

  return String(binCode % 10 ** DIGITS).padStart(DIGITS, '0');
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/** Generates `count` random recovery codes, formatted like XXXX-XXXX-XXXX. */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`);
  }
  return codes;
}
