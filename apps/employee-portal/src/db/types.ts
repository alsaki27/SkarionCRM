import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type * as schema from './schema.js';

export type HrDb = NeonHttpDatabase<typeof schema>;
