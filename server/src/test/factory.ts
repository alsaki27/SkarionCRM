import { db } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import { authService } from '../services/auth.js';

export async function createTestOrg() {
  const [org] = await db.insert(organizations).values({
    name: 'Test Org',
    slug: 'test-org-' + Date.now(),
    status: 'active',
  }).returning();
  return org;
}

export async function createTestUser(orgId: string, role = 'owner') {
  const passwordHash = await authService.hashPassword('test123');
  const [user] = await db.insert(users).values({
    orgId,
    email: `test-${Date.now()}@example.com`,
    fullName: 'Test User',
    role,
    passwordHash,
    isActive: true,
  }).returning();
  return user;
}
