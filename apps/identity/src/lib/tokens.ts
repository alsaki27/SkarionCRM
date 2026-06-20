// apps/identity/src/lib/tokens.ts
// JWT (access tokens) via Hono's built-in Workers-native jwt utility (Web
// Crypto under the hood - no Node-only crypto APIs). Opaque tokens (refresh,
// invitation, password reset) are random strings sent to the user; only
// their SHA-256 hash is ever stored, so a DB leak doesn't hand out usable
// tokens directly.

import { sign, verify } from 'hono/jwt';
import type { AppMembershipsMap } from './types.js';

const JWT_ALG = 'HS256';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export interface AccessTokenPayload {
  sub: string;
  email: string;
  apps: AppMembershipsMap;
  ver: number;
  iat: number;
  exp: number;
  // Hono's JWTPayload requires an index signature - this stays structurally
  // typed for the fields above via the explicit properties.
  [key: string]: unknown;
}

export async function signAccessToken(
  params: { userId: string; email: string; apps: AppMembershipsMap; tokenVersion: number },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: params.userId,
    email: params.email,
    apps: params.apps,
    ver: params.tokenVersion,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return sign(payload, secret, JWT_ALG);
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenPayload> {
  const payload = await verify(token, secret, JWT_ALG);
  return payload as unknown as AccessTokenPayload;
}

/** Random URL-safe opaque token (refresh token, invitation token, password reset token). */
export function generateOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** SHA-256 hash of an opaque token, hex-encoded - this is what gets stored in the DB. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
