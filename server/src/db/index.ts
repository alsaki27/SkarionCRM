import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const client = postgres(connectionString, {
  ssl: 'require',
  max: 10,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
