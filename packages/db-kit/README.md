# @skarion/db-kit

Shared Drizzle + Neon helpers used by every app (identity, crm, employee-portal, accounting).

## `getDb(env, schema)`

Returns a typed Drizzle client using the `neon-http` driver (HTTP fetch, no
persistent connection — see the comment in `src/client.ts` for why this is
_not_ the same transport Hyperdrive accelerates).

```ts
import { getDb } from '@skarion/db-kit';
import * as schema from './db/schema.js';

const db = getDb(env, schema);
```

## Mixins

```ts
import { timestamps, softDelete } from '@skarion/db-kit';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  ...timestamps(),
  ...softDelete(),
});
```

## `withAudit`

Writes one row to whichever `audit_log`-shaped table you pass it (each
Postgres schema owns its own audit_log table).

```ts
import { withAudit } from '@skarion/db-kit';
import { auditLog } from './db/schema.js';

await withAudit(db, auditLog, {
  actorUserId: user.id,
  action: 'user.disable',
  resourceType: 'user',
  resourceId: targetUserId,
  before: { disabledAt: null },
  after: { disabledAt: new Date().toISOString() },
});
```

## Migrations

Each app owns its own `drizzle.config.ts` and runs `drizzle-kit generate`
directly (it needs per-app schema context that db-kit doesn't have). Applying
already-generated migrations goes through this package so every app applies
the same way, with no `psql` binary dependency:

```bash
# from an app directory, e.g. apps/identity
pnpm drizzle-kit generate
tsx ../../packages/db-kit/scripts/migrate-cli.ts --folder=./drizzle
```

## Local testing limitation (important)

`@neondatabase/serverless`'s `neon()` function is **not** a generic Postgres
driver — it parses the connection string's hostname and calls Neon's HTTPS
Data API (`https://api.<host>/sql`). It cannot connect to a plain local
Postgres instance (e.g. `127.0.0.1:5433`); it only works against a real Neon
database (prod, dev branch, or a PR preview branch). This was confirmed
directly: `getDb`/`runMigrations` work correctly when pointed at a real Neon
URL, but throw `Failed to parse URL from https://api.0.0.1/sql` against a
local host. The schema and migration SQL themselves were validated locally
by applying the generated `.sql` file directly via `psql` instead — that
proves the schema design is correct independent of the Neon-specific
transport, which still needs a real Neon branch to exercise end-to-end.

## Neon PR branching

See `.github/workflows/neon-branch-preview.yml` at the repo root — creates a
temporary Neon branch per PR, runs migrations against it, tears it down on
close. Needs `NEON_API_KEY` / `NEON_PROJECT_ID` repo secrets (ticket 1.8).
