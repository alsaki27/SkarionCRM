import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('::1');

const client = postgres(connectionString, {
  ssl: isLocal ? false : 'require',
  max: 10,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
