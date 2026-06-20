// apps/identity/src/scripts/seed-admin.ts
// Seeds the first admin user into the identity database.
// Run once after identity migrations: tsx apps/identity/src/scripts/seed-admin.ts
// Requires DATABASE_URL env var.

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@skarion.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme-now';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Admin';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sqlClient = neon(dbUrl);
  const db = drizzle(sqlClient, { schema });

  const existing = await db.query.users.findFirst({
    where: (t, { sql: s }) => s`lower(${t.email}) = lower(${ADMIN_EMAIL})`,
  });

  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL} (id=${existing.id})`);
    if (!existing.isSuperadmin) {
      await db.update(schema.users).set({ isSuperadmin: true }).where(sql`id = ${existing.id}`);
      console.log('Upgraded to superadmin.');
    }
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const [user] = await db.insert(schema.users).values({
    email: ADMIN_EMAIL,
    displayName: ADMIN_NAME,
    passwordHash,
    isSuperadmin: true,
  }).returning();

  await db.insert(schema.appMemberships).values({
    userId: user.id,
    app: 'crm',
    role: 'manager',
  });

  console.log(`Admin user created:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Superadmin: true`);
  console.log(`  CRM role: manager`);
  console.log(`\nIMPORTANT: Change the password immediately after first login.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
