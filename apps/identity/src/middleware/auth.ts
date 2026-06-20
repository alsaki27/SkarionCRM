// apps/identity/src/middleware/auth.ts

import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../lib/tokens.js';
import type { AppMembershipsMap, Env } from '../lib/types.js';

export interface AuthedVariables {
  userId: string;
  userEmail: string;
  apps: AppMembershipsMap;
}

/** Requires a valid `Authorization: Bearer <jwt>` header. Attaches userId/email/apps to context. */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: AuthedVariables }>,
  next: Next
) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required.' }, 401);
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    c.set('apps', payload.apps);
  } catch {
    return c.json({ error: 'Invalid or expired token.' }, 401);
  }
  await next();
}

/** Requires the caller to hold one of `allowedRoles` on `app` (call after requireAuth). */
export function requireAppRole(app: 'crm' | 'hr' | 'books', allowedRoles: string[]) {
  return async (c: Context<{ Bindings: Env; Variables: AuthedVariables }>, next: Next) => {
    const apps = c.get('apps');
    const role = apps[app];
    if (!role || !allowedRoles.includes(role)) {
      return c.json({ error: 'Forbidden.' }, 403);
    }
    await next();
  };
}
