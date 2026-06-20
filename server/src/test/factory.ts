import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import { authService } from '../services/auth.js';

// Date.now() alone collides under vitest's parallel test-file execution
// (multiple workers can land on the same millisecond), which trips the
// organizations.slug / users.email unique constraints. A uuid suffix makes
// each test run's rows unique regardless of timing.
export async function createTestOrg() {
  const [org] = await db.insert(organizations).values({
    name: 'Test Org',
    slug: `test-org-${Date.now()}-${randomUUID()}`,
    status: 'active',
  }).returning();
  return org;
}

export async function createTestUser(orgId: string, role = 'owner') {
  const passwordHash = await authService.hashPassword('test123');
  const [user] = await db.insert(users).values({
    orgId,
    email: `test-${Date.now()}-${randomUUID()}@example.com`,
    fullName: 'Test User',
    role,
    passwordHash,
    isActive: true,
  }).returning();
  return user;
}
