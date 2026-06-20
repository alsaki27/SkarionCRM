# Handover to Kimi: Chunk 2 — CRM Core Data Model & API

## Who you're talking to, and what this document is

You (Kimi) previously built a different, smaller approach to moving
SkarionCRM to Cloudflare: a "lift-and-shift" that kept the existing
Express/tRPC monolith and made it Workers-compatible, on the
`cloudflare-deploy` branch. Abdullah (the project owner) decided to go a
different direction instead: a full ground-up rewrite as a Turborepo
monorepo targeting Cloudflare Workers + Pages + Neon Postgres, built from
a detailed 6-chunk spec he wrote. That rewrite lives on a **separate
branch: `cloudflare-platform-rewrite`**. Claude (this session) has been
building it chunk by chunk, with Abdullah relaying each completed,
verified chunk to you for the next one.

**Chunk 1 (Foundation & Identity Service) is complete, validated, and
deployed.** This document hands you **Chunk 2 (CRM Core Data Model &
API)**.

### Critical branch hygiene — read this before touching anything

- Work **only** on `cloudflare-platform-rewrite`. Do not touch
  `cloudflare-deploy` or `main` — those are Abdullah's other live/legacy
  surfaces and are unrelated to this rewrite.
- Do not rename or redeploy to the Worker/Pages project names already
  used by `cloudflare-deploy` (`skarion-crm-api`, Pages project
  `skarion-crm`). This rewrite's identity service deliberately uses
  different names (`skarion-identity`, `skarion-identity-admin`,
  `skarion-identity-login`) specifically so the two efforts can coexist in
  the same Cloudflare account without one overwriting the other. Follow
  the same pattern for the CRM Worker you're about to build — e.g.
  `skarion-crm-platform` or similar, NOT `skarion-crm-api`.
- The repo already has these GitHub Actions secrets configured and
  confirmed working: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `DATABASE_URL`, `JWT_SECRET`. Three more exist for the identity service
  specifically and don't apply to you: `RESEND_API_KEY`,
  `MFA_ENCRYPTION_KEY`, `INVITATION_TOKEN_PEPPER`.

### One important caveat about this document

This handover was written from a conversation summary, not from the
original verbatim Chunk 2 specification text Abdullah pasted earlier in
the project. The deliverables below are a best-effort reconstruction
based on standard CRM domain modeling and the patterns already
established in Chunk 1 — **if Abdullah still has the original Chunk 2
spec text, ask him to paste it and treat it as authoritative over
anything below that conflicts.**

---

## What already exists (Chunk 1 — don't rebuild, reuse)

Repo: `github.com/alsaki27/SkarionCRM`, branch `cloudflare-platform-rewrite`.

```
apps/
  identity/            Hono Worker - users, app memberships, invitations,
                        MFA, password reset, admin endpoints. REST, not tRPC.
  identity/admin/       Vite React SPA - admin UI for managing users/invites
  identity/login/       Vite React SPA - public login/forgot/reset/accept-invite
  crm/                  EMPTY STUB - this is what you're building out
  employee-portal/      EMPTY STUB - future chunk
  accounting/           EMPTY STUB - future chunk
  workers/              EMPTY STUBS - cron, email-inbound, embeddings-builder,
                        workflow-runner (future chunks)
packages/
  db-kit/               Shared Drizzle + Neon helpers (see below)
  auth-client/          Shared JWT verification + Hono auth middleware +
                        Resend email sending - YOU WILL IMPORT FROM THIS
  ui/                   React Email templates (emails/) - shared branding
  permissions/          EMPTY STUB - this is what you're building out
  importers/            EMPTY STUB - this is what you're building out
  ai-toolkit/            EMPTY STUB - future chunk
  eventbus/              EMPTY STUB - future chunk
```

### The identity → CRM auth contract (this is the most important pattern to get right)

Identity issues short-lived (15 min) JWTs signed with `JWT_SECRET`
(HS256, via `hono/jwt`). The payload shape, defined in
`packages/auth-client/src/types.ts`:

```ts
interface AccessTokenPayload {
  sub: string; // user id (uuid)
  email: string;
  apps: Partial<Record<'crm' | 'hr' | 'books', string>>; // app -> role
  ver: number; // token version, bumped on password change/forced logout
  iat: number;
  exp: number;
}
```

**Your CRM Worker does NOT call back into identity per-request.** It
trusts the JWT directly, using the exact same verification logic identity
uses, imported from the shared package:

```ts
import { requireAuth, requireAppRole, type AuthedVariables } from '@skarion/auth-client';

const app = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
app.use('*', requireAuth); // sets userId/userEmail/apps
app.use('/admin/*', requireAppRole('crm', ['superadmin'])); // role gate example
```

`c.get('apps').crm` gives you the caller's CRM role (e.g. `superadmin`,
`manager`, `outreach`, `viewer` — exact role names are your call for
Chunk 2's permission model, just be consistent). `c.get('userId')` /
`c.get('userEmail')` give you the caller's identity.

Do not duplicate `verifyAccessToken` or write your own JWT decoding —
import it. If you need a new capability that doesn't fit
`requireAppRole`'s simple role-allowlist shape, that's exactly what
`packages/permissions` (a CRM-specific capability/permission matrix) is
for — build it as your own package, on top of the role string already in
the JWT, not as a change to the JWT contract itself.

### Database patterns (`@skarion/db-kit`)

- Driver: `@neondatabase/serverless`'s `neon-http` (HTTP fetch to Neon's
  Data API), wrapped by `getDb(env, schema)`. **This is not a generic
  Postgres driver** — it cannot connect to a local non-Neon Postgres
  instance at all. For local validation during development, use a
  throwaway `postgres.js` + `drizzle-orm/postgres-js` client against a
  local Postgres instead (see the pattern in identity's now-deleted
  `validate-*.ts` scripts — git log on `apps/identity` will show several
  examples of this exact validation style if you want a template), then
  delete the throwaway script before committing. Never commit a
  dependency on `postgres.js` to a real app's `package.json` — it's
  dev-only, for local proof, and gets removed again afterward.
- Each Postgres schema-namespace owns its own tables via `pgSchema(...)`
  (identity uses `pgSchema('identity')`). Give the CRM tables their own
  `pgSchema('crm')` namespace, mirroring identity's `db/schema.ts`.
- **`drizzle-kit generate` cannot resolve workspace package imports.**
  Schema files fed to drizzle-kit get loaded by a plain Node `require()`
  that can't follow `.js`-suffixed relative imports back to `@skarion/*`
  packages' `.ts` source. Any small helper your schema file needs (e.g. a
  `timestamps()` mixin) must be **inlined directly in the schema file**,
  not imported from `db-kit`, even though db-kit has the same helper for
  runtime (non-drizzle-kit) code. See the comment block at the top of
  `apps/identity/src/db/schema.ts` for the full explanation — copy the
  pattern exactly.
- `withAudit(db, auditTable, entry)` from db-kit writes one row to
  whichever `audit_log`-shaped table you pass it. Give CRM its own
  `crm.audit_log` table (same shape as identity's) and call `withAudit`
  on every mutation that matters (record create/delete/reassign, at
  minimum).
- Migrations: `pnpm drizzle-kit generate` from `apps/crm`, then apply via
  `tsx ../../packages/db-kit/scripts/migrate-cli.ts --folder=./drizzle`
  (wire this as `db:generate` / `db:migrate` scripts in
  `apps/crm/package.json`, matching identity's).

### The pnpm duplicate-dependency trap (you WILL hit this — read before debugging it yourself)

`drizzle-orm` has several **optional peer dependencies**
(`kysely`, and separately `@cloudflare/workers-types` once you add real
Workers types). If a package that has `drizzle-orm` as a direct
dependency does NOT also have those optional peers present, pnpm can
resolve two _physically different_ instances of `drizzle-orm` in
`node_modules/.pnpm` — one with the peer resolvable, one without. This
breaks TypeScript's structural typing on Drizzle's branded/protected
class members (`PgColumn`, etc.) with cryptic errors like `Property
'config' is protected but type 'Column<...>' is not a class derived
from 'Column<...>'` or `db.query.X does not exist on type '{}'`.

**Fix, every time this happens:** make sure every package that has
`drizzle-orm` as a _direct_ dependency also has `kysely` and
`@cloudflare/workers-types` as direct dependencies (devDependency is
fine for the latter), pin exact versions (no `^` ranges) for
`drizzle-orm` / `@neondatabase/serverless`, add them to
`pnpm-workspace.yaml`'s `overrides` block, then do a **full clean
reinstall** (`rm -rf node_modules pnpm-lock.yaml` at the repo root, plus
every nested `node_modules`, then `pnpm install`) — incremental installs
do not flush the stale duplicate resolution. Verify with:
`find node_modules/.pnpm -maxdepth 1 -iname "drizzle-orm@*"` — there
should be exactly one matching directory.

### Workers runtime types

`apps/identity/tsconfig.json` uses `"types": ["@cloudflare/workers-types"]`,
not `"types": ["node"]` — this is a Workers app and needs `CryptoKey`,
`ExecutionContext`, etc. Use the same for `apps/crm`. `db-kit` keeps
`"types": ["node"]` because its CLI migration script genuinely runs under
Node via `tsx`, not in a Worker — don't change that.

### Validation discipline (non-negotiable, per ticket)

For every ticket: `pnpm typecheck` and `pnpm lint` from the repo root
must both pass cleanly across the whole monorepo (not just your new
package — the duplicate-dependency trap above means a clean typecheck in
isolation can still break others). Then prove the actual logic works
against a real database, not just that it compiles — every ticket in
Chunk 1 was validated this way: a throwaway script using
`postgres.js`/`drizzle-orm/postgres-js` against a local Postgres,
exercising the real service functions end-to-end (e.g. create a company →
create a contact under it → create an opportunity → list/filter →
mutate → assert the audit log row exists), with explicit pass/fail
checks printed, not just "it didn't throw." Delete the throwaway script
afterward. For any frontend work, also run the actual Vite build and hit
the dev server directly via curl for each new source file — `tsc --noEmit`
alone has missed real Babel/JSX-transform-level bugs before in this
project (a component/icon name collision broke `vite build` while
`tsc --noEmit` stayed green).

Commit and push each ticket separately to `cloudflare-platform-rewrite`
with a commit message explaining what was built and how it was validated
(see this branch's git log for the established tone/detail level — every
commit documents real validation results, not just a description of the
diff).

---

## Chunk 2 deliverables

### 2.1 — `packages/permissions`

A CRM-specific permission/capability model layered on top of the simple
`apps.crm` role string from the JWT. At minimum, model these CRM roles:
`superadmin` (full access, including other reps' records), `manager`
(full access to their team's records), `outreach` (their own records
only), `viewer` (read-only, own records or team depending on manager
status). Expose a small API like:

```ts
export function can(
  role: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'reassign',
  resource: { ownerId: string },
  caller: { userId: string; managedUserIds?: string[] }
): boolean;
```

Exact shape is your call — just make it something the CRM API layer
(2.4/2.5) actually calls on every mutating and list endpoint, not a
package that exists but never gets imported.

### 2.2 — CRM Drizzle schema (`apps/crm/src/db/schema.ts`)

`pgSchema('crm')` containing, at minimum:

- **companies** — name, domain, industry, size, address fields, owner
  (rep) user id, timestamps, soft-delete
- **contacts** — first/last name, email, phone, title, company_id (FK),
  owner user id, timestamps, soft-delete
- **leads** — pre-qualification stage entity: contact/company info
  (either inline or FK'd once qualified), source, status
  (new/contacted/qualified/disqualified/converted), owner, timestamps
- **opportunities** (deals) — name, company_id/contact_id FKs, stage
  (enum: prospecting/qualification/proposal/negotiation/closed_won/closed_lost),
  amount, currency, expected_close_date, owner, timestamps
- **activities** — polymorphic-ish log of calls/emails/meetings/notes
  against a contact/company/opportunity, actor user id, timestamps
- **tasks** — title, due_date, assignee user id, related resource
  (contact/company/opportunity), completed_at, timestamps
- **crm.audit_log** — same shape as identity's, own withAudit calls

Add relations (`relations()` calls) mirroring identity's schema.ts style.
Reuse the inlined `timestamps()` helper pattern (copy, don't import, per
the drizzle-kit limitation above). Add a `softDelete()` mixin usage where
db-kit's helper applies (`deletedAt: timestamp`).

Decide whether `owner` references identity's `users.id` directly (cross-
schema FK within the same Neon database — Postgres allows this within
one database across schemas) or stores a bare UUID with no FK constraint
(since identity and crm being separate Workers doesn't mean separate
databases — confirm with `DATABASE_URL` whether they're the same Neon
project/database; if so, a real FK is fine and preferable).

### 2.3 — `apps/crm` Worker scaffold

Hono app, `requireAuth` + `requireAppRole('crm', [...])` per the contract
above. Health check route. Wire `wrangler.toml` following
`apps/identity/wrangler.toml`'s pattern (own Worker name, no Hyperdrive
binding for the same neon-http-transport reason documented there, unless
you've changed the driver — if so, document why and update db-kit's
README accordingly since that's a project-wide decision, not a
chunk 2-only one).

### 2.4 / 2.5 — API routers

The original spec calls for tRPC here (vs. identity's deliberate choice
of REST) — if you have the original Chunk 2 text confirming this, follow
it; tRPC's type-safe client/server contract is the natural fit for the
CRM frontend you'll stub in 2.8. CRUD + list/search/filter for each
entity in 2.2, permission-checked via 2.1 on every call, audit-logged via
`withAudit` on every mutation.

### 2.6 — `packages/importers`

CSV import for contacts/companies/leads — parse, validate, dedupe (at
minimum by email for contacts, by domain for companies), report
row-level errors rather than failing the whole batch on one bad row.

### 2.7 — Seed data script

Realistic demo data: a handful of companies, contacts per company,
leads, opportunities across different pipeline stages, some activities
and tasks — enough to make the eventual CRM frontend look like a real,
in-use CRM rather than an empty shell. Should be idempotent/runnable
against a fresh Neon branch.

### 2.8 — Stub CRM frontend

A Vite React SPA shell (`apps/crm/web` or similar — match the
`apps/identity/admin` / `apps/identity/login` pattern of nested
sub-packages, remembering to add the explicit path to
`pnpm-workspace.yaml`'s package globs since `apps/*` does not match
nested subdirectories). Auth: redirect to the identity login app
(`auth.skarion.com`) when no valid token, matching the `return_to`
pattern `apps/identity/login/src/redirect.ts` already implements on the
identity side — don't reinvent that, just point the CRM app's
unauthenticated redirect at `https://auth.skarion.com/?return_to=<crm-url>`.
A dashboard placeholder is enough for this chunk; full CRM UI is Chunk 3.

### 2.9 — Deployment + secrets

`.github/workflows/deploy-crm.yml`, scoped to push on
`cloudflare-platform-rewrite` only (same scoping reasoning as
`deploy-identity.yml` — so it doesn't fire on `cloudflare-deploy` and
vice versa). Reuse the already-confirmed `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` / `DATABASE_URL` secrets. Document any new
secrets/variables this chunk needs at the top of the workflow file, the
same way `deploy-identity.yml` does.

---

## How the verification loop works

Abdullah will relay each ticket (or the whole chunk) to Claude for
verification once you've pushed it. Push incrementally rather than
holding everything until the end — smaller, separately-validated commits
are easier to verify and unblock the next step faster.
