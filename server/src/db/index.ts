import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema.js';

export type DB = ReturnType<typeof createDB>;

export function createDB(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

// Module-level singleton with live binding for backward compatibility.
// All routers import `db` from this module; the binding stays live so
// when `setDB()` is called (e.g. in the Workers fetch handler), every
// importer sees the new instance automatically.
let _db: DB = undefined as unknown as DB;

export function setDB(url: string) {
  _db = createDB(url);
}

export function getDB(): DB {
  return _db;
}

// Auto-initialize for local development (tsx, drizzle-kit, seed scripts).
if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
  setDB(process.env.DATABASE_URL);
}

export { _db as db };
