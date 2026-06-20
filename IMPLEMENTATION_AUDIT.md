# SkarionCRM Implementation Audit

Last updated: 2026-06-19

## Fixed in this pass

- Installed and refreshed npm workspace dependencies so the lockfile matches the workspace packages.
- Restored the root production build path.
- Fixed Drizzle schema defaults for array columns and self-referential foreign keys that blocked server emit.
- Fixed cron service imports and date comparisons for date-string Drizzle columns.
- Fixed AI transaction analysis join key usage from `chartOfAccounts` to `chart_of_accounts`.
- Fixed JWT signing/role typing in the auth service.
- Fixed client build import drift:
  - `LandingPage.tsx` now imports UI components from the correct `src/components` path.
  - Timekeeping pages now import `api.ts` instead of missing `api.tsx`.
  - Added the missing `client/src/components/ui/index.tsx` barrel used by 1099 pages.
- Added ESLint 9 flat config so `npm run lint` runs.
- Updated Vitest config to use an absolute server root and alias.

## Validation Results

- `npm run build`: passes.
- `npm run lint`: passes with existing warnings, mostly unused imports and one React hook dependency warning.
- `npm run test --workspace=server`: starts, but fails because `DATABASE_URL` is not configured for tests.
- `npm run typecheck --workspace=server`: fails.
- `npm run typecheck --workspace=client`: fails.

## Remaining Fixes Needed

1. Server typecheck cleanup.

   The server still has many TypeScript errors in routers. The largest buckets are Drizzle enum filters receiving plain `string` inputs, timestamp columns receiving ISO strings where Drizzle expects `Date`, insert/update payloads not matching schema-required fields, employee/user display-name references using `name`/`fullName` inconsistently with the schema, and heavy timekeeping schema drift.

2. Client typecheck cleanup.

   The client still has broad TypeScript failures. The largest buckets are `.ts`/`.tsx` import extensions without `allowImportingTsExtensions`, missing Vite `ImportMeta.env` typing, broken shared `AppRouter` typing with tRPC method-name collisions, and inconsistent local user/component types such as `User.name` versus stored `fullName`.

3. Test database setup.

   Server tests import the real DB module, which throws if `DATABASE_URL` is missing. Add a documented local test database, `.env.test`, or test-time DB mocks before relying on CI tests.

4. Runtime/database audit.

   `npm run build` now emits, but because the server build uses `--noCheck`, the remaining type errors may correspond to runtime bugs in affected routes. Do a route-by-route smoke test with a real PostgreSQL database before production use.

5. Dependency/security cleanup.

   `npm install` reported 11 npm audit vulnerabilities: 8 moderate, 1 high, and 2 critical. Do not run forced audit fixes blindly; review dependency impact first.

## Deployment Status

The repository is more deployable than before this pass because the production build completes, but it is not production-ready. The next pass should prioritize typecheck correctness and a real test database over new product features.

## Pass 2 (2026-06-19): AI key manager, chat assistant, dependency cleanup

### Added
- **Admin-managed AI provider keys** (`Settings -> AI Providers`, owner/admin only): new `ai_provider_keys` table (org-scoped, AES-256-GCM encrypted at rest via `server/src/security/secretCrypto.ts`), repository (`services/aiProviderKeys.ts`), provider-resolution service (`services/aiClient.ts` — env vars first, then highest-priority enabled DB key), and a full CRUD+test tRPC router (`routers/aiKeys.ts`). Full keys are never returned after save, never logged; only a fingerprint (first 6 + last 4 chars) is shown. Supports OpenAI, Kimi/Moonshot, Ollama, OpenRouter, DeepSeek (all OpenAI-API-compatible, so one client builder covers all of them).
- **Chat assistant** (floating widget, all authenticated pages): `routers/chat.ts` + `services/aiDataTools.ts`. Role-scoped server-side, not client-side: owner/admin/accountant/bookkeeper get read-only OpenAI function-calling tools across invoices, transactions, compliance, headcount, and payroll (org-scoped); employee/viewer only get tools scoped to their own employee record (own PTO balance, own timesheets). No free-form SQL execution anywhere — every tool is a fixed, parameterized, reviewed query. Conversations persist to the existing (previously unused) `ai_conversations` table.
- Generated migration `0003_broken_hammerhead.sql` for the new table. It also picked up `employees.user_id`, a column that was already in `schema.ts` but had drifted out of sync with the actual migration history — applying this migration fixes that drift too.
- Removed the unused `node-cron`/`@types/node-cron` dependency (the codebase actually uses the `cron` package; `node-cron` was dead weight pulling in a vulnerable `uuid` transitive dependency). `npm audit` dropped from 11 to 9 vulnerabilities, and the remaining 9 are all dev-tooling only (vite/vitest/drizzle-kit/esbuild) — none reachable in the deployed app, all require major-version bumps that should be tested deliberately rather than forced.
- Fixed `Sidebar.tsx` referencing `user.name` (doesn't exist on the `User` type — it's `fullName`); extended the nav's existing-but-unused `roles` filter to also apply to sub-items (it only filtered top-level items before), and used it to hide the new AI Providers link from non-admins.
- Added `AI_KEYS_ENCRYPTION_SECRET` (and documented `KIMI_API_KEY`/`KIMI_BASE_URL`) to `.env.example` and `DEPLOYMENT_GUIDE.md`.

### Verified
- `npm run build` (server + client): passes.
- `npm run lint`: 0 errors (165 pre-existing warnings, unchanged in kind from before this pass).
- New files (`aiKeys.ts`, `chat.ts`, `aiClient.ts`, `aiDataTools.ts`, `aiProviderKeys.ts`, `secretCrypto.ts`) typecheck with **zero errors** in isolation.
- Confirmed via `git stash` that the pre-existing `tsc --noEmit` failures (server: ~201 lines; client: the `AppRouter` "collides with a built-in method" error on ~482 lines) exist identically without any of this pass's changes — this pass added 2 more router properties (`chat`, `aiKeys`) to the same already-broken type union, but did not cause it. It's a static-analysis-only issue: `vite build` doesn't type-check, so it doesn't block builds or break runtime (confirmed — both builds pass).
- `vitest run` (server): still fails past the `DATABASE_URL` guard with `role "postgres" does not exist` / connection errors — there is no reachable Postgres in this environment (no Docker available to start one). Same root cause as "Remaining Fixes Needed #3" below, unchanged by this pass.

### Deployment (Cloudflare + Neon)
`DEPLOYMENT_GUIDE.md` already documented the correct architecture before this pass: **Neon** for Postgres (drop-in `DATABASE_URL` swap — the existing `postgres-js` driver works against Neon directly), **Cloudflare Pages** for the static Vite client (config + `_redirects` already present), and a **Node host** (Railway/Render/Fly.io/Docker — all pre-configured: `railway.json`, `render.yaml`, `fly.toml`, `docker-compose.yml`) for the Express/tRPC API.

Cloudflare Workers cannot run the API server as-is: Express requires a persistent Node process (Workers are fetch-event-based, not `listen()`-based), `postgres.js` needs raw TCP (Workers' TCP socket support is limited/beta and not what this driver expects), and the `cron` package's in-process scheduling has no equivalent in Workers (would need Cloudflare Cron Triggers, a different model entirely). Porting the API to Workers would mean replacing the Express entrypoint with the tRPC fetch adapter, swapping `postgres.js` for `@neondatabase/serverless`, and rewriting `services/cron.ts` around Cron Triggers — a substantial, separate effort, not attempted here. Recommend keeping the API on one of the already-configured Node hosts.

No Cloudflare or Neon credentials exist in this repo/environment, so no live deploy was attempted — `AI_KEYS_ENCRYPTION_SECRET` was generated locally for `.env` only (gitignored, not committed). Once Neon/Cloudflare credentials are available: create the Neon project, set `DATABASE_URL`, run `npm run db:migrate` (this also applies the new `ai_provider_keys` table and the `employees.user_id` drift fix), deploy `client/dist` to Cloudflare Pages per the existing guide, deploy `server` to the chosen Node host, and set `AI_KEYS_ENCRYPTION_SECRET` there too.

### Still open (pre-existing, not addressed this pass — same as before)
1. Server/client typecheck cleanup (Drizzle enum/Date mismatches, tRPC `AppRouter` collision, import-extension convention).
2. Real test database / `.env.test` setup so `vitest run` can execute past the connection guard.
3. Route-by-route runtime smoke test against a real Postgres instance (build uses `--noCheck`, so type errors could still hide runtime bugs in older routers).
