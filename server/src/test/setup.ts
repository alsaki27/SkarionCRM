import { db } from '../db/index.js';

export function createTestContext(user?: any, orgId?: string | null) {
  return {
    user: user || null,
    orgId: orgId ?? user?.orgId ?? null,
    db,
  };
}
