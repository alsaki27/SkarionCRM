import type { getDb } from '@skarion/db-kit';
import type * as schema from './schema.js';

/**
 * Derived directly from getDb's own generic instantiation (rather than a
 * separate `Db<typeof schema>` alias) so it lines up exactly with what
 * `getDb(c.env, schema)` actually returns at the call site in index.ts.
 */
export type IdentityDb = ReturnType<typeof getDb<typeof schema>>;
