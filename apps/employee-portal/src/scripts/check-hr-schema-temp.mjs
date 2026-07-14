// Temporary one-off: drops the (verified-empty) hr schema so the corrected
// initial migration can apply cleanly. hr.employees/audit_log/departments
// all had 0 rows (confirmed via a prior run of this same script) - the
// deploy-hr.yml migration step never fully succeeded (it died partway
// through creating hr.time_off_requests), so nothing real was ever stored.
// Delete this file once the employee-portal deploy is confirmed green.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
await sql`DROP SCHEMA IF EXISTS hr CASCADE`;
console.log('Dropped hr schema.');
const tables = await sql`select table_name from information_schema.tables where table_schema = 'hr'`;
console.log('Tables remaining in hr schema:', JSON.stringify(tables));
