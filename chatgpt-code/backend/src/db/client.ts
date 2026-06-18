import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from '@supabase/postgres-js';
import * as schema from './schema.js';

// Create a Postgres client using the connection string provided in the
// environment.  Supabase exposes a standard Postgres URL for its
// database, so the same connection string works here.  The client
// supports both SSL and non‑SSL connections; Supabase requires SSL.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Configure the postgres client.  `@supabase/postgres-js` accepts
// connection options as the second argument.  The search path is
// explicitly set to `public` to avoid schema conflicts.
const client = postgres(connectionString, {
  ssl: 'require',
  max: 10,
});

// Create a Drizzle database instance.  The `schema` option allows
// Drizzle to provide typed accessors for all tables.
export const db = drizzle(client, { schema });

export type DB = typeof db;