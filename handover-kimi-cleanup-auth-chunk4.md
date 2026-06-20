# Instructions for Kimi: kill the monolith paths, fix auth/login, fix roles, then Chunk 4

Pull `cloudflare-platform-rewrite` first — confirm `pnpm typecheck` (23/23)
and `pnpm lint` (18/18) pass clean before changing anything. Do the
sections below **in order** — each one unblocks the next. Don't skip to
Chunk 4 until sections 1–4 are done and verified.

## 0. Why this doc exists

Claude audited your latest push. Real progress: full CRUD now exists for
all 6 CRM entities, the importers got wired up, Chunk 3's dashboard/list/
detail/form work is solid. But two things are seriously broken, and
Abdullah wants the role model tightened before Chunk 4 starts. This doc
covers all of it, in the order to fix it.

## 1. Stop touching the old monolith — consolidate onto this branch only

There are currently **three** live efforts on this repo:

- `main` — the original Vite+Express+tRPC monolith. Has 9 new commits as
  of this audit (security headers, a CRM permissions package, backup
  runbooks) — meaning someone has kept patching it in parallel with this
  rewrite.
- `cloudflare-deploy` — your earlier lift-and-shift of that same monolith
  onto Workers. Its deploy has been failing repeatedly.
- `cloudflare-platform-rewrite` — this branch, the ground-up rewrite,
  where all real progress now lives.

**Your action:** stop opening any further PRs/commits against `main` or
`cloudflare-deploy`. Everything from here on goes to
`cloudflare-platform-rewrite` only.

**Not your action (flagging for Abdullah, don't do it yourself):**
formally archiving `main` and `cloudflare-deploy` (e.g. renaming to
`archive/main-legacy-monolith`) and deciding what happens to whatever's
currently live from those branches in Cloudflare/Vercel/wherever. That's
a call about production traffic and history, not something to execute
unilaterally. If you're not sure whether a given task is "rewrite" or
"monolith" work, ask before touching either old branch.

## 2. Fix the auth/login infrastructure (this is currently fully broken)

Two separate problems, both real, both currently breaking login in
production regardless of any code correctness:

### 2a. `auth.skarion.com` does not exist in DNS

Confirmed via `nslookup`: `Non-existent domain`. Every redirect-to-login
and token-refresh call in the CRM frontend (`apps/crm/web/src/api.ts`,
`AppShell.tsx`), and identity's own CORS/CSP config, hardcodes this
domain. The identity Worker itself is alive and healthy at its real
`*.workers.dev` URL — nothing is actually wrong with identity, there's
just no real domain pointed at it yet.

**Fix:**

- In Cloudflare's dashboard (Workers & Pages → the identity Worker →
  Settings → Domains & Routes), attach a **Custom Domain**:
  `auth.skarion.com` → the `skarion-identity` Worker. This requires
  `skarion.com`'s DNS zone to already be on this Cloudflare account
  (confirmed it is — `skarion.com` itself resolves to Cloudflare IPs).
- Do the same for the two Pages projects once 2b is fixed: pick real
  subdomains for the login and admin SPAs (e.g. the login app could
  literally BE `auth.skarion.com` if you serve it from Pages and proxy
  `/auth/*`, `/me`, `/invitations/*` etc. to the Worker — or use a
  separate subdomain like `id-admin.skarion.com` for the admin app and
  keep `auth.skarion.com` for the public login SPA specifically, matching
  what `apps/identity/login`'s own code already assumes it's hosted at).
  Decide the exact subdomain split, but **don't leave any of them
  unattached** — that's the actual root cause here, not a code bug.
- Until the domain is attached, anything depending on `auth.skarion.com`
  will keep failing identically. Verify with `nslookup auth.skarion.com`
  and a real browser request before considering this done — don't trust
  a "looks configured" dashboard state, confirm it resolves and serves
  the right thing.

### 2b. `deploy-identity.yml` has failed on its last 5 runs

Job-level breakdown from the most recent run:

- **Deploy public login Pages site** — fails at "Deploy to Cloudflare
  Pages". Almost certainly because the Pages project doesn't exist yet —
  `cloudflare/pages-action@v1` can't create a brand-new project, only
  deploy to an existing one. You already solved this exact problem for
  the CRM Pages project (`skarion-crm`) — create the
  `skarion-identity-login` and `skarion-identity-admin` Pages projects
  first (dashboard or `wrangler pages project create`), then the existing
  workflow step should succeed.
- **Deploy identity admin Pages site** — same failure, same fix.
- **Deploy identity Worker** — fails at "Set DATABASE_URL secret", after
  the actual `wrangler deploy` step succeeds. Check whether
  `CLOUDFLARE_API_TOKEN` still has the right permissions (Workers
  Scripts: Edit) — this exact step was working in earlier runs, so
  something changed (token rotated/expired, or a Cloudflare-side rate
  limit from the volume of deploys today). Get the real error text from
  the Actions run logs (Abdullah has admin access to pull these; Claude
  doesn't) before guessing further.

**Verify before moving on:** a real, successful run of
`deploy-identity.yml` end to end, and `https://auth.skarion.com/health`
resolving and returning `200` from a real browser or `curl`, not just the
`workers.dev` URL.

## 3. Fix the login flow code issues found in review

- `apps/crm/web/src/components/layout/AppShell.tsx` calls
  `fetch('https://auth.skarion.com/auth/refresh', ...)` directly to
  bootstrap the auth store, completely bypassing
  `apps/crm/web/src/api.ts`'s own `refreshAccessToken()`. This means two
  independent refresh calls happen on every page load (one from
  `AppShell`, one from `api.ts` the first time `crmFetch` runs), and the
  access token `AppShell` receives is thrown away — never stored in
  `api.ts`'s module-level `accessToken` variable. It still technically
  works (both calls succeed independently against the same cookie), but
  it's wasteful and a footgun for the next person who assumes there's one
  source of truth for the token. Fix: have `AppShell` call a shared
  `bootstrapAuth()` function exported from `api.ts` that does the refresh
  _and_ sets `accessToken`, instead of its own raw `fetch`.
- Stop hardcoding `https://auth.skarion.com` as a string literal in
  multiple files. Put it in one place (an env var or a shared constant
  exported from `api.ts`), so when the real domain changes or local/
  staging environments need a different value, there's one edit, not a
  grep-and-replace.

## 4. Standardize the role model (do this before Chunk 4)

Abdullah's explicit ask: **one superadmin role with access to
everything** (not per-app), **manager roles scoped per app**, **team
members with limited controls**. Today, `superadmin` is checked
per-app-membership (`apps.crm === 'superadmin'`) — a user could be
`crm:superadmin` but have nothing on `hr`/`books`. That's not what's
wanted; superadmin should be a single global flag that bypasses every
app's role check entirely.

### 4a. Add a true global superadmin flag at the identity level

In `apps/identity/src/db/schema.ts`, add a column to `users`:

```ts
isSuperadmin: boolean('is_superadmin').notNull().default(false),
```

Generate a migration (`pnpm db:generate` from `apps/identity`). This is
the single source of truth — not a membership row, not a per-app role
string. Manually flip this to `true` for Abdullah's own account via a
one-off script (same pattern as any other admin bootstrap task) — ask
Abdullah which user before running it.

### 4b. Put it in the JWT, check it first, everywhere

In `packages/auth-client/src/types.ts`, add `isSuperadmin: boolean` to
`AccessTokenPayload`. In `apps/identity/src/lib/tokens.ts`'s
`signAccessToken`, include it. In `packages/auth-client/src/middleware.ts`,
`requireAppRole` should return early (allow) if `c.get('isSuperadmin')` is
true, **before** checking `allowedRoles` — so a superadmin never needs an
explicit per-app membership row to access anything. Update
`apps/identity/src/middleware`'s equivalent check (the `requireAdmin`-
style helper at `apps/identity/src/index.ts:114-116`) the same way: a
global superadmin should pass that check unconditionally, independent of
per-app role strings.

### 4c. Collapse the per-app role set to two: `manager` and `member`

Today `packages/permissions/src/index.ts` has four CRM roles:
`superadmin`, `manager`, `outreach`, `viewer`. Per Abdullah's model,
`superadmin` moves to the global flag (4a/4b) and isn't a per-app role
string anymore. Collapse the remaining three into two:

- `manager` — full access within that app (current `manager` semantics:
  view everything, edit/delete own or team-managed records)
- `member` — limited (current `outreach` semantics: own records only,
  can't delete or reassign) — this replaces both `outreach` and `viewer`;
  if Abdullah wants a true read-only tier distinct from `member`, ask
  before inventing one, don't guess.

Update `can()`/`canList()` in `packages/permissions/src/index.ts`
accordingly, update every `requireAppRole('crm', [...])` call site in
`apps/crm/src/index.ts` to use the new two-role set, and update
`apps/crm/web`'s `NAV_ITEMS` role arrays (`AppShell.tsx`) and any other
frontend role-gating to match. Existing data: write a migration or
one-off script to remap any `app_memberships.role` rows currently set to
`superadmin`/`outreach`/`viewer` into the new scheme (`superadmin` rows
→ set that user's `users.is_superadmin = true` and remove the per-app
membership role distinction; `outreach`/`viewer` → `member`).

### 4d. Apply the same model to `hr`/`books` when those chunks start

This role model (global superadmin + per-app manager/member) should be
the standard for every app this identity service fronts, not CRM-
specific. Nothing to build yet for `hr`/`books` since they're still
stubs, but don't reintroduce a fourth role or a different hierarchy when
Chunk 6 starts them.

**Validate before moving on:** a real database check confirming a
superadmin-flagged user passes `requireAppRole` checks on an app they
have zero membership rows for, and that `manager`/`member` scoping still
works correctly for everyone else. `pnpm typecheck` + `pnpm lint` clean
across the whole repo.

## 5. Chunk 4 — Email/Workflows/Integrations

Once 1–4 are done, validated, and pushed:

- **Email**: transactional email beyond what identity already sends
  (invites, password reset, MFA-enrolled) — CRM-side notifications (task
  due reminders, lead-assigned, opportunity-stage-changed) via the
  existing `@skarion/ui/emails` + Resend pattern from
  `apps/identity/src/index.ts`. Reuse `packages/auth-client/src/email.ts`'s
  `sendEmail()`, don't build a second email-sending path.
- **Workflows**: simple rule-based automation (e.g. "when a lead is
  created from source X, auto-assign to user Y", "when an opportunity
  sits in a stage > N days, create a follow-up task"). Scope this as a
  `crm.workflow_rules` table + a Worker cron or queue-triggered evaluator
  — check with Abdullah on exact rule shapes before building a generic
  rule engine; start with the 2-3 concrete cases above if no broader spec
  exists.
- **Integrations**: this was scoped for Chunk 4 in the original 6-chunk
  plan but the exact external systems (calendar sync? Slack? something
  else?) weren't detailed in what Claude has access to. Confirm with
  Abdullah what's actually needed before building speculative integration
  surface — don't guess at OAuth flows for services nobody asked for.

Same rules as every prior chunk: incremental commits per ticket, real
database/build validation (not just `tsc --noEmit`), push to
`cloudflare-platform-rewrite` only, typecheck/lint clean every time.
