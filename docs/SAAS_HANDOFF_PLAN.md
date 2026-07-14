# Skarion Platform — Handoff Spec for GLM

**Repo:** `alsaki27/SkarionCRM`, branch `main`.

> **Note on how this doc was built:** it was written from a direct read of the code at commit `849ba38`. Before that version could be pushed, the repo moved to `848b2d1` (two new commits: a CRM outreach revamp and a full build-out of `apps/employee-portal` as an HR app). This version has been corrected against `848b2d1` — Phase 3 in particular is rewritten from "build from scratch" to "extend what exists." Phases 0/1/2 were re-checked against the diff between those two points (`git diff --stat 849ba38 848b2d1 -- apps/identity apps/accounting packages/auth-client packages/permissions` → only `apps/accounting/package.json` changed, a dependency bump, nothing behavioral) and still hold. **Re-run that same kind of diff check against current `main` before starting** — this doc will drift again if more commits land before GLM starts.

**Scope (confirmed with Abdullah):** single-tenant, Skarion-only. Not building multi-org/billing/tenant isolation. Four requirements, each phased below:
1. Accounting (`apps/accounting`, internal app-name `books`) is **admin-only, forever**.
2. Admin invites employees by email; **only company-domain emails accepted**; admin chooses per-employee whether they get CRM, employee-portal (HR/PTO), both, or neither.
3. **Every login requires a one-time code emailed to the user** — not optional, not skippable, not "remember this device."
4. `apps/employee-portal` — confirmed with Abdullah that the already-built PTO/time-off + employee/department management (see below) satisfies "timekeeping"; **no clock-in/out hours-tracking subsystem is in scope**. This phase is now "finish and polish," not "build from scratch."

**Ground truth this plan is built against** (verified by reading the actual files, not assumed):
- Auth today: password + bcrypt (`apps/identity/src/services/auth.ts:61` `login()`), **optional** TOTP-authenticator MFA gated by `mfaSecrets.enrolledAt` (nothing forces enrollment). No email-OTP infra exists anywhere.
- `app_memberships` table already models one role per `{user, app}` for exactly three apps: `crm`, `hr`, `books` (`apps/identity/src/db/schema.ts:47`, `appEnum`). `hr` is **now the live, in-use employee-portal app** (departments/employees/time-off) — do not rename or repurpose this enum value, Phase 2 no longer proposes that (see below).
- `packages/auth-client/src/middleware.ts` already has `requireSuperadmin()` and `requireAppRole(app, allowedRoles)` — reusable, no changes needed to this package for phases 0–2.
- Accounting (`apps/accounting/src/index.ts`) uses `requireAuth` + a hand-rolled `getRole(c)` reading `apps.books`, then `@skarion/permissions`' `can()` — i.e. any user holding a `books` app-membership (`manager` or `member`) gets full CRUD today. This is the bug Phase 0 fixes.
- Invitations (`apps/identity/src/services/invitations.ts`) and the admin UI (`apps/identity/admin/src/pages/InvitationsList.tsx`) accept **any** email string — no domain check anywhere, client or server.
- Emails render via React Email templates in `packages/ui/emails/*.tsx`, aggregated in `packages/ui/emails/index.tsx` (`renderXEmail()` functions returning `{subject, preheader, html, text}`), sent via `sendEmail()` from `@skarion/auth-client`. This pattern is what Phase 1's new login-code email must follow exactly.
- No test framework is configured anywhere in the repo (confirmed: no jest/vitest config, `grep` for `*.test.ts`/`*.spec.ts` returns nothing). Phase 4 sets this up; Phase 1 is the first phase that actually needs tests, per the rule below.
- `apps/employee-portal` (as of `848b2d1`) is a real Hono+Drizzle Worker (mirrors `apps/accounting`'s structure exactly) with a Postgres `hr` schema: `departments`, `employees` (linked to `identity.users` via `userId`), `time_off_requests` (vacation/sick/personal/bereavement/other, pending/approved/rejected/cancelled), plus `audit_log`. API routes exist for full CRUD on all three plus `/api/time-off/:id/review` (approve/reject). Frontend (`apps/employee-portal/web`) has `DashboardPage`, `DepartmentsPage` (152 lines, real), `EmployeesPage` (208 lines, real), `TimeOffPage` (222 lines, real), `SettingsPage` — but **`DepartmentDetailPage.tsx` and `EmployeeDetailPage.tsx` are both 11-line placeholders** (`{ const { id } = useParams(); return <p>Employee ID: {id}</p>; }` — no real detail view, no edit form, no linked time-off history).

**Standing rules for every phase (copy the pattern of `handover-kimi-next-steps.md`, which is already in this repo and worked for the last contributor):**
- One commit per ticket, not one commit per phase.
- `pnpm typecheck` and `pnpm lint` clean across the **whole repo** after every ticket, not just the app touched.
- Never hand-edit an already-applied migration SQL file. Generate new migrations with `pnpm db:generate` (run inside the specific app directory, e.g. `cd apps/identity && pnpm db:generate`).
- Soft-delete only, `withAudit(...)` after every mutation — this is the existing convention in every app, don't break it.
- Before touching `apps/accounting`'s Pages/Worker config or any shared Cloudflare project config, ask Abdullah first (per the existing warning in `handover-kimi-next-steps.md` step 3 — this project has been burned by an agent silently reconfiguring shared infra before).
- If a ticket's assumption turns out wrong once you're in the code (e.g. a table/column doesn't exist as described here), stop and say so explicitly rather than silently improvising — this doc was written from a point-in-time read of the code and could be stale by the time you start.

---

## PHASE 0 — Security lockdown (do first, small, high-value)

### Ticket 0.1 — Lock accounting to superadmin-only

**Problem:** `apps/accounting/src/index.ts` applies `app.use("/api/*", requireAuth)` then per-route `can(isSuperadmin, role, action, ...)` checks using the `books` role from `app_memberships`. This lets any `manager`/`member` books-role holder do full CRUD — not admin-only.

**Fix:**
```ts
// apps/accounting/src/index.ts, right after the existing:
app.use("/api/*", requireAuth);
// add:
app.use("/api/*", requireSuperadmin());
```
Import `requireSuperadmin` from `@skarion/auth-client` (already imported as `requireAuth` on line 4 — add to that import).

Once this is in place, every `getRole(c)` / `can(...)` check in the file becomes dead code for authorization purposes (superadmin always passes `can()`'s first branch: `if (isSuperadmin || caller.isSuperadmin) return true;`). **Do not rip out `getRole`/`can()` calls in this ticket** — leave them as defense-in-depth; removing them is a separate, riskier refactor not in scope here. Just add the gate.

**Before merging:** query production for any non-superadmin user currently holding a `books` app-membership:
```sql
select u.email, u.is_superadmin, am.role
from identity.app_memberships am
join identity.users u on u.id = am.user_id
where am.app = 'books' and am.revoked_at is null;
```
If any non-superadmin rows exist, tell Abdullah before deploying — this change will lock them out of accounting entirely, which may or may not be intended for those specific people.

**Acceptance:** a non-superadmin user with a `books` membership gets 403 on every `/api/*` route in accounting; a superadmin (with or without a `books` membership) still works.

### Ticket 0.2 — Company email-domain allowlist on invitations

**Problem:** `createInvitation()` in `apps/identity/src/services/invitations.ts:14` and the admin UI form in `InvitationsList.tsx` accept any email string.

**Fix — backend** (`apps/identity/src/services/invitations.ts`):
```ts
const ALLOWED_INVITE_DOMAINS = ['skarion.com']; // confirm final list with Abdullah — see open question below

function isAllowedInviteDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && ALLOWED_INVITE_DOMAINS.includes(domain);
}
```
Call this at the top of `createInvitation()`, before the `existingActive` check:
```ts
if (!isAllowedInviteDomain(params.email)) {
  throw new AuthError(`Invitations are only allowed for these domains: ${ALLOWED_INVITE_DOMAINS.join(', ')}`, 400);
}
```
Put `ALLOWED_INVITE_DOMAINS` in `apps/identity/src/lib/types.ts`'s `Env` interface as a new env var (`ALLOWED_INVITE_DOMAINS: string` — comma-separated, parsed at call site) rather than hardcoding, so it can change without a redeploy-from-source. Add it to `apps/identity/wrangler.toml`'s `[vars]` and to `docs/DEPLOYMENT_STATUS.md`'s secrets/vars table.

**Fix — frontend** (`InvitationsList.tsx`): this is cosmetic (backend is the real gate) but add client-side validation so admins get instant feedback instead of a round-trip error — check the email ends with an allowed domain before calling `createInvitation`, show inline error if not. Fetch the allowed-domains list from a new tiny endpoint (`GET /invitations/allowed-domains`, public-safe since it's not sensitive) rather than hardcoding it twice.

**Acceptance:** `POST /invitations` with a non-`@skarion.com` email returns 400 with a clear message; `@skarion.com` emails still work end-to-end.

**Open question for Abdullah — do not guess:** is `skarionengineering.com` also a live employee domain that needs to be allowed, or is `skarion.com` the only one? [[project_talentos_skarion_job_pipeline]] confirms Skarion Engineering is the real employer entity, so this is plausible but not confirmed — ask before hardcoding the final list.

### Ticket 0.3 — Wire Resend for real

**Problem:** per `docs/DEPLOYMENT_STATUS.md`'s "Current Blockers" table, `RESEND_API_KEY` is a required secret that (per that doc) isn't actually set — invitations/password-reset/MFA-enrolled emails are attempted via `sendEmail()` but fail silently (every call site already wraps `sendEmail` in try/catch and just `console.error`s — see `apps/identity/src/index.ts:236-239` etc., so this won't throw, it'll just silently not deliver).

**Fix:** this is an infra/ops step, not a code change — confirm a Resend account + verified sending domain exists for Skarion, then set the `RESEND_API_KEY` secret via `wrangler secret put RESEND_API_KEY` in both `apps/identity` and `apps/workers/email-inbound` (per `DEPLOYMENT_STATUS.md`'s existing manual-deploy command list) or via the GitHub Actions secret so it flows through `deploy-identity.yml`/`deploy-email-inbound.yml`. **This must be done before Phase 1** — mandatory login-code emails are useless if email delivery isn't actually wired.

**Acceptance:** trigger a real invitation from the admin UI against a real skarion.com inbox and confirm the email arrives (not just that the API call returns 200).

---

## PHASE 1 — Mandatory email-OTP on every login

This is the largest single unit of new code in this plan. It replaces "optional TOTP MFA" as the day-to-day second factor with "always-required emailed code," while optionally keeping TOTP as an *extra* factor for superadmins only (see Ticket 1.6, confirm with Abdullah first — see open question at the end of this phase).

### Ticket 1.1 — Schema: `login_otp_codes` table

Add to `apps/identity/src/db/schema.ts`, following the exact style of the existing `passwordResetTokens` table (same file, ~line 145):

```ts
// ─────────────────────────────────────────────────────────
// login_otp_codes
// ─────────────────────────────────────────────────────────
export const loginOtpCodes = identitySchema.table(
  'login_otp_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    pendingTokenHash: text('pending_token_hash').notNull(), // ties this code to the specific login attempt
    attemptCount: integer('attempt_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_login_otp_pending_token_hash').on(table.pendingTokenHash),
    index('idx_login_otp_user').on(table.userId),
  ]
);
```

Why a separate `pendingTokenHash` rather than reusing a session/JWT: after step 1 (password check) succeeds, the server must not yet issue a real access/refresh token — issuing one before the OTP step would defeat the whole point. Instead it issues an **opaque, short-lived "pending login" token** (same `generateOpaqueToken()`/`sha256Hex()` pattern already used for refresh tokens, `apps/identity/src/lib/tokens.ts`), returned to the client and stored hashed alongside the OTP code, expiring with it (10 minutes). Add relation:
```ts
export const loginOtpCodesRelations = relations(loginOtpCodes, ({ one }) => ({
  user: one(users, { fields: [loginOtpCodes.userId], references: [users.id] }),
}));
```
Generate the migration: `cd apps/identity && pnpm db:generate`, then review the generated SQL before committing (per the repo's existing convention — don't hand-edit, but do read it).

### Ticket 1.2 — Email template: `LoginCode.tsx`

New file `packages/ui/emails/LoginCode.tsx`, copy the shape of `packages/ui/emails/PasswordReset.tsx` exactly:

```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout.js';

export interface LoginCodeEmailProps {
  code: string;
  expiresInMinutes: number;
}

export const loginCodeSubject = 'Your Skarion sign-in code';
export const loginCodePreheader = 'Use this code to finish signing in.';

export function LoginCodeEmail({ code, expiresInMinutes }: LoginCodeEmailProps) {
  return (
    <EmailLayout preheader={loginCodePreheader}>
      <Text>Enter this code to finish signing in to Skarion:</Text>
      <Text style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '6px', fontFamily: 'monospace' }}>
        {code}
      </Text>
      <Text style={{ fontSize: '13px', color: '#71717a' }}>
        This code expires in {expiresInMinutes} minutes. If you didn't try to sign in, you can
        safely ignore this email — no one can access your account without this code.
      </Text>
    </EmailLayout>
  );
}
```

Register it in `packages/ui/emails/index.tsx`: import it alongside the other templates, add:
```ts
export async function renderLoginCodeEmail(props: {
  code: string;
  expiresInMinutes: number;
}): Promise<RenderedEmail> {
  const { html, text } = await renderBoth(<LoginCodeEmail {...props} />);
  return { subject: loginCodeSubject, preheader: loginCodePreheader, html, text };
}
```
and add `LoginCodeEmail` to the final re-export line.

### Ticket 1.3 — Service layer: split `login()` into two steps

In `apps/identity/src/services/auth.ts`, this is the core change. Current `login()` (line 61) does password check → MFA check (if enrolled) → issues real tokens, in one call. New shape:

```ts
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

export interface LoginStep1Params {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
  resendApiKey: string;
  appUrl: string; // unused for the email itself, kept for parity with other senders if needed later
}

export interface LoginStep1Result {
  pendingToken: string;
  expiresAt: Date;
}

/** Step 1: verify email+password, email a 6-digit code, return an opaque pending token (NOT a session). */
export async function loginStep1(db: IdentityDb, params: LoginStep1Params): Promise<LoginStep1Result> {
  const found = await db.query.users.findFirst({
    where: (t, { sql }) => sql`lower(${t.email}) = lower(${params.email})`,
  });
  if (!found || !found.passwordHash || found.disabledAt) {
    throw new AuthError('Invalid email or password.', 401);
  }
  const validPassword = await verifyPassword(params.password, found.passwordHash);
  if (!validPassword) throw new AuthError('Invalid email or password.', 401);

  const pendingToken = generateOpaqueToken();
  const pendingTokenHash = await sha256Hex(pendingToken);
  const code = generateNumericCode(6); // new helper, see below
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(schema.loginOtpCodes).values({
    userId: found.id,
    codeHash,
    pendingTokenHash,
    expiresAt,
  });

  // Caller (route) sends the email - keep email I/O out of the service layer,
  // consistent with how requestPasswordReset() returns the token and lets
  // index.ts do the sendEmail call.
  return { pendingToken, expiresAt };
  // NOTE: route layer needs the plaintext `code` to email it - either return
  // it here (fine, it's already been hashed for storage, this is the one
  // moment it's held in memory) or restructure so this function takes an
  // email-sending callback. Returning it is simpler and matches this
  // codebase's existing style (see requestPasswordReset returning `token`
  // in plaintext for the route to embed in a URL) - just make sure it's
  // never logged.
}

export interface LoginStep2Params {
  pendingToken: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
  jwtSecret: string;
}

/** Step 2: verify the emailed code against the pending token, issue the real session. */
export async function loginStep2(db: IdentityDb, params: LoginStep2Params): Promise<LoginResult> {
  const pendingTokenHash = await sha256Hex(params.pendingToken);
  const otp = await db.query.loginOtpCodes.findFirst({
    where: eq(schema.loginOtpCodes.pendingTokenHash, pendingTokenHash),
  });
  if (!otp || otp.consumedAt || otp.expiresAt < new Date()) {
    throw new AuthError('Code expired or invalid. Please sign in again.', 401);
  }
  if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
    throw new AuthError('Too many incorrect attempts. Please sign in again.', 429);
  }

  const codeHash = await sha256Hex(params.code);
  if (codeHash !== otp.codeHash) {
    await db.update(schema.loginOtpCodes)
      .set({ attemptCount: otp.attemptCount + 1 })
      .where(eq(schema.loginOtpCodes.id, otp.id));
    throw new AuthError('Incorrect code.', 401);
  }

  await db.update(schema.loginOtpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.loginOtpCodes.id, otp.id));

  const found = await db.query.users.findFirst({ where: eq(schema.users.id, otp.userId) });
  if (!found || found.disabledAt) throw new AuthError('Account disabled.', 401);

  // --- from here down, this is exactly the tail of the OLD login() ---
  const apps = await getActiveMemberships(db, found.id);
  const accessToken = await signAccessToken(
    { userId: found.id, email: found.email, apps, isSuperadmin: found.isSuperadmin, tokenVersion: found.tokenVersion },
    params.jwtSecret
  );
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = await sha256Hex(refreshToken);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await db.insert(schema.sessions).values({
    userId: found.id, refreshTokenHash,
    userAgent: params.userAgent ?? null, ip: params.ip ?? null,
    expiresAt: refreshTokenExpiresAt,
  });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, found.id));

  return {
    accessToken, refreshToken, refreshTokenExpiresAt,
    user: { id: found.id, email: found.email, displayName: found.displayName, isSuperadmin: found.isSuperadmin, apps },
  };
}
```

Add `generateNumericCode(length: number): string` to `apps/identity/src/lib/tokens.ts`, using `crypto.getRandomValues` (Workers-safe, same as `generateOpaqueToken`) — not `Math.random()`.

**Decide and document one thing explicitly in the commit message:** what happens to the *old* `login()` function and the invitation-accept flow at `apps/identity/src/index.ts:363` (`app.post('/invitations/accept', ...)` calls `authService.login(...)` directly to auto-sign-in a newly-accepted user). Recommendation: keep `login()` as an internal-only helper used by `acceptInvitation`'s auto-login (a user who just proved they own the invite link and set a password doesn't need an OTP round-trip on that exact request — that's arguably already sufficient proof of email ownership), but the **public `/auth/login` route** (Ticket 1.4) must call `loginStep1`/`loginStep2`, never the old `login()`, going forward. Rename the old function to `loginInternal()` or similar so it's not confused with the new public flow, and add a one-line comment explaining why it still exists and skips OTP.

### Ticket 1.4 — Routes: `apps/identity/src/index.ts`

Replace the single `app.post('/auth/login', ...)` handler with two:

```ts
app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  if (!body.email || !body.password) return c.json({ error: 'email and password are required.' }, 400);
  const db = getDb(c.env, schema);
  try {
    const result = await authService.loginStep1(db, {
      email: body.email,
      password: body.password,
      ip: c.req.header('CF-Connecting-IP') ?? null,
      userAgent: c.req.header('User-Agent') ?? null,
      resendApiKey: c.env.RESEND_API_KEY,
      appUrl: c.env.APP_URL,
    });
    // Send the code email here (route layer owns email I/O, per existing convention).
    const email = await renderLoginCodeEmail({ code: /* the plaintext code from step1 */, expiresInMinutes: 10 });
    try {
      await sendEmail(c.env.RESEND_API_KEY, { to: body.email, ...email });
    } catch (err) {
      console.error('Failed to send login code email:', err);
      // Do NOT swallow this one silently like other emails - if the code
      // can't be delivered, the user is stuck. Return an explicit error
      // instead of a fake success (this is the one email send in the app
      // where "fire and forget" is wrong).
      return c.json({ error: 'Could not send sign-in code. Please try again shortly.' }, 502);
    }
    return c.json({ pending_token: result.pendingToken, expires_at: result.expiresAt });
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post('/auth/login/verify', async (c) => {
  const body = await c.req.json<{ pending_token: string; code: string }>();
  if (!body.pending_token || !body.code) return c.json({ error: 'pending_token and code are required.' }, 400);
  const db = getDb(c.env, schema);
  try {
    const result = await authService.loginStep2(db, {
      pendingToken: body.pending_token,
      code: body.code,
      ip: c.req.header('CF-Connecting-IP') ?? null,
      userAgent: c.req.header('User-Agent') ?? null,
      jwtSecret: c.env.JWT_SECRET,
    });
    setRefreshCookie(c, result.refreshToken, result.refreshTokenExpiresAt);
    return c.json({ access_token: result.accessToken, user: result.user });
  } catch (err) {
    return errorResponse(c, err);
  }
});
```
(Fix the `LoginStep1Result`/plaintext-code plumbing noted in Ticket 1.3 — return the plaintext `code` from `loginStep1` alongside `pendingToken`/`expiresAt`, matching how `requestPasswordReset` already returns a plaintext `token` for its route to embed in a URL. Don't log it.)

**Rate-limit `/auth/login` and `/auth/login/verify` per email/IP** — reuse the same in-memory `checkRateLimit` pattern already in `apps/accounting/src/index.ts` (lines 10-27, `Map<string, RateLimitEntry>`), copy it into identity (or better, lift it into a shared spot in `@skarion/auth-client` since accounting, and now identity, both want it — your call, but don't leave it duplicated a third time without at least flagging it). Suggested limits: 5 login attempts / 15 min per email, 10 verify attempts / 15 min per pending token (on top of the DB-level `attemptCount` cap already in `loginStep2`).

### Ticket 1.5 — Frontend: `apps/identity/login`

`Login.tsx` currently does password+optional-mfaCode in one form submit (see the file — `needsMfa` state toggles a second input in place). Replace with a real two-step flow:
- Step 1 form: email + password → `POST /auth/login` → on success, store `pending_token` in component state, switch to step 2 view (don't put it in localStorage — it's short-lived and only needed for the immediate next request, a plain `useState` living in the same page load is enough, matching this app's "don't persist tokens beyond what's needed" convention already established in `handover-kimi-next-steps.md`'s note about avoiding localStorage for the access token).
- Step 2 form: single 6-digit code input, "Resend code" link (re-calls `POST /auth/login` — same email/password aren't re-entered; either cache them in step-1 state to resend, or require the resend to go through step 1 again — simpler and safer to just require step 1 again, avoids holding the password in memory longer than needed) → `POST /auth/login/verify` → on success, same `me()` + `redirectAfterLogin()` flow already in the current `handleSubmit`.
- Update `apps/identity/login/src/api.ts` accordingly (add `loginVerify(pendingToken, code)`, change `login()`'s return type to `{pending_token, expires_at}`).
- Remove the `mfaCode`/`needsMfa` state entirely from `Login.tsx` **unless** Ticket 1.6 (superadmin-only optional TOTP) is confirmed in scope — if it is, TOTP becomes a *third* optional step after OTP succeeds, only prompted for superadmin accounts (the `/auth/login/verify` response would need a way to signal "TOTP also required" — extend `loginStep2`'s error path or success payload to indicate this; design this precisely once Ticket 1.6 is confirmed, don't guess ahead of that answer).

### Ticket 1.6 — Decide TOTP's fate (needs Abdullah's answer before building)

Options, pick one before starting Ticket 1.3 in earnest since it changes `loginStep2`'s shape:
- **(a)** Drop TOTP/MFA-enrollment entirely — email-OTP is the only factor for everyone, remove `/auth/mfa/*` routes and `mfa_secrets` table (bigger diff, removes code, cleaner end state).
- **(b) (recommended in the original audit)** Keep TOTP as an *additional* optional factor, but only offered/relevant for superadmin accounts, layered after email-OTP succeeds.
- **(c)** Leave TOTP code entirely as-is (still optional, still available to any user who wants it) just running *in addition to* the now-mandatory email-OTP for whoever has it enrolled — least code change, but means some users type two codes and most type one, which may be confusing.

This plan assumes **(b)** in Ticket 1.5's wording above, but this is a product decision, not a technical one — confirm before building.

### Ticket 1.7 — Tests (first test suite in the repo)

Set up Vitest for `apps/identity` (root `turbo.json` already has a `test` task wired, just currently nothing to run). Add `vitest` + `@cloudflare/vitest-pool-workers` (or a plain node-based Vitest run against the service functions directly, which is simpler since `auth.ts` is explicitly framework-agnostic per its own header comment — prefer this, avoid pulling in Workers-runtime test infra just for pure-function service logic). Cover, at minimum:
- `loginStep1`: correct password → returns pending token; wrong password → 401; disabled account → 401.
- `loginStep2`: correct code → session issued; wrong code → 401 + attemptCount increments; code reused after `consumedAt` set → 401; expired code → 401; 6th wrong attempt → 429 even with eventual correct code.
- Rate limiter (if lifted to a shared module per Ticket 1.4) as a standalone pure-function test.

Use a real local Postgres for anything hitting the DB (per this repo's own existing convention noted in `handover-kimi-next-steps.md`: `@neondatabase/serverless`'s `neon-http` driver can't reach non-Neon hosts, use `postgres.js`/`drizzle-orm/postgres-js` for test scripts against local Postgres — see `packages/db-kit/README.md`). Wire this into `apps/identity/package.json`'s `test` script and confirm `pnpm test` at the repo root actually exercises it.

**Acceptance for all of Phase 1:** manually test end-to-end against a real skarion.com inbox — password → real email arrives with a 6-digit code within ~10s → code accepted → session works against a downstream app (CRM). Then confirm a wrong code, an expired code (wait or manipulate `expiresAt` in a test), and 6 wrong attempts all fail correctly.

---

## PHASE 2 — Admin UI cleanup (no enum rename — `hr` is live, keep it)

The original version of this plan proposed renaming the `hr` app-enum value to `timekeeping`. **That's now wrong and must not be done** — `apps/employee-portal` already ships a real, in-use `hr` Postgres schema and app-membership value (departments/employees/time-off). Renaming it would mean a genuinely disruptive enum rebuild for a purely cosmetic label change. Keep the internal name `hr`; if the product wants a friendlier label, change display strings only (`APP_LABELS.hr` in `apps/identity/src/index.ts:25`, currently `'Employee Portal'` — already fine, no change needed) — never the enum/type value.

### Ticket 2.1 — Admin UI: role dropdown instead of free-text

`UserDetail.tsx`'s per-app role input (`apps/identity/admin/src/pages/UserDetail.tsx:105-111`) is currently `<input type="text">`. Change to `<select>` with options `''` (no access), `'member'`, `'manager'` — matches `@skarion/permissions`' actual `CrmRole` type (`"manager" | "member"`), preventing admins from typo-ing a role string that silently grants zero permissions (today, typing `"amdin"` would just fail every `can()` check with no warning). Same for `InvitationsList.tsx`'s role text input (`apps/identity/admin/src/pages/InvitationsList.tsx:90-96`) — same dropdown, `member`/`manager` only, no blank option there since a new invitation needs *some* role. This applies to all three apps (`crm`, `hr`, `books`) — the dropdown, not the app list, is what's changing.

**Acceptance:** `pnpm typecheck`/`pnpm lint` clean; admin can grant a user `hr: member` (or `manager`) via a dropdown and it round-trips correctly through `PATCH /admin/users/:id/memberships`.

---

## PHASE 3 — Finish `apps/employee-portal` (it's built, not empty — polish and close gaps)

**Correction from the original version of this plan:** at the time this plan was first drafted, `apps/employee-portal` was a 3-file stub. Two commits later (`f30ecad "feat: CRM outreach revamp + Employee Portal (HR) app"`, landed before this doc could be pushed), it became a real Hono+Drizzle Worker mirroring `apps/accounting`'s structure, with a full `hr` Postgres schema (`departments`, `employees`, `time_off_requests`, `audit_log`) and API routes for CRUD on all three plus `/api/time-off/:id/review` (approve/reject). Frontend has `DashboardPage`, `DepartmentsPage` (152 lines), `EmployeesPage` (208 lines), `TimeOffPage` (222 lines), `SettingsPage` — all real. **Confirmed with Abdullah: this PTO/time-off + employee/department management is sufficient for "timekeeping"; a clock-in/out hours-tracking subsystem is explicitly out of scope.** Phase 3 is now about closing real gaps in what's there, not building from zero.

### Ticket 3.1 — Fill in the two placeholder detail pages

`apps/employee-portal/web/src/pages/DepartmentDetailPage.tsx` and `EmployeeDetailPage.tsx` are both currently 11-line stubs:
```tsx
export default function EmployeeDetailPage() {
  const { id } = useParams();
  return <div><h1>Employee Detail</h1><p>Employee ID: {id}</p></div>;
}
```
Build these out properly, following the pattern already established in `EmployeesPage.tsx`/`DepartmentsPage.tsx` (list views) and the detail-page pattern used elsewhere in the monorepo (e.g. `apps/crm/web/src/pages/ContactDetail.tsx`, `CompanyDetail.tsx` — read one of those for the shape: fetch-by-id, edit-in-place form, related-records section, back link).
- `EmployeeDetailPage`: fetch `GET /api/employees/:id`, show full employee fields (position, department, hire date, salary — gate salary visibility to manager/superadmin only, this is sensitive), an edit form (`PUT /api/employees/:id` — route already exists), and that employee's time-off history (`GET /api/time-off?employeeId=` — check whether the existing route actually supports filtering by arbitrary `employeeId` for a manager, per `apps/employee-portal/src/index.ts`'s `/api/time-off` handler it currently only allows `employeeId` filter `if (employeeId && isSuperadmin)` — **this is a real gap**: a `manager`-role user can't currently view a specific employee's time-off list this way, only superadmin can. Either extend that condition to include `role === 'manager'` or add a dedicated `GET /api/employees/:id/time-off` route — pick one, don't leave it superadmin-only if managers are meant to review their team).
- `DepartmentDetailPage`: fetch `GET /api/departments/:id`, edit form (`PUT /api/departments/:id`), and list of employees in that department (`GET /api/employees?departmentId=` — route already supports this filter, confirmed in the existing code).

### Ticket 3.2 — Verify/fix permission checks that look inconsistent

While reading `apps/employee-portal/src/index.ts` for this plan, several routes compute `role`/`caller` via `getRole(c)` but then **never call `can()`** before mutating — e.g. `PUT /api/departments/:id`, `DELETE /api/departments/:id`, `PUT /api/employees/:id`, `DELETE /api/employees/:id` all fetch `_role`/`isSuperadmin` but skip the `can(...)` gate that `POST` on the same resources uses (compare to `POST /api/departments` at line 122, which does call `can(...)`). As written, **any authenticated user holding any `hr` role (or even just passing `requireAuth`, need to double check `!role` isn't implicitly checked earlier in these handlers) can edit or soft-delete any department or employee record** — this reads like an oversight from whoever built this quickly, not an intentional design choice (it's inconsistent with `POST`'s own gating in the same file, and inconsistent with how `apps/accounting` gates every single mutation). **Verify this against the actual current code first** (line numbers may have shifted), and if confirmed, add the missing `can(isSuperadmin, role, 'edit'|'delete', {ownerId: ...}, caller)` checks — note `departments`/`employees` don't have an `ownerId` column, so this needs a shape decision: either treat all `hr`-role holders symmetrically (any `member`/`manager` can edit, only `manager`/`superadmin` can delete — matches the existing `time_off_requests` review-endpoint pattern which already restricts to `role === 'manager'`), or introduce owner/manager scoping. Recommend the simpler symmetric model unless Abdullah wants per-manager department scoping.

### Ticket 3.3 — Salary field exposure

`employees.salary`/`salaryCurrency` are returned by `GET /api/employees` and `GET /api/employees/:id` with no field-level restriction — any `hr`-role holder (including `member`) can see everyone's salary today. Decide with Abdullah whether this needs restricting to `manager`/superadmin only (likely yes for a real HR tool) and if so, strip those fields in the response for non-manager callers rather than relying on the frontend to hide them (a `member`-role user could still call the API directly).

### Ticket 3.4 — Deploy plumbing check

Confirm `apps/employee-portal` already has (it should, since it's a real built app now, but verify rather than assume): a `.github/workflows/deploy-*.yml` entry, Cloudflare Pages/Worker projects, and an entry in `docs/DEPLOYMENT_STATUS.md`'s tables. If any of these are missing despite the app code existing, that's the actual remaining Phase 3 gap to fill — check before writing new deploy config from scratch, since duplicate/conflicting Cloudflare projects are exactly the kind of shared-infra mess this doc's standing rules warn against.

**Acceptance for Phase 3:** a user granted `hr: member` can log in (through the new mandatory-OTP flow from Phase 1), view/edit their own employee record, view department info, submit a time-off request, and see it appear as pending; a user granted `hr: manager` additionally sees and can approve/reject others' time-off requests, and can view (but per Ticket 3.3, only if authorized) salary data; the two detail pages from Ticket 3.1 show real data, not a placeholder; a user with no `hr` membership gets 403 on every `/api/*` route in this Worker.

---

## PHASE 4 — Hardening (do last, or interleave once Phases 0-3 are stable)

- **Tests**: extend the Vitest setup from Ticket 1.7 to cover `packages/permissions`'s `can()`/`canList()` (pure functions, cheap to test exhaustively — every role × action × ownership combination), and add one smoke test per app to `scripts/smoke-production.ts` (already exists, extend its pattern for accounting's admin-lockdown and the new employee-portal).
- **Observability**: none exists today beyond Cloudflare's default dashboards. Add structured error logging (Sentry or Cloudflare Logpush) so a 500 in production is visible without someone reporting it; add an uptime check against each Worker's `/health` endpoint (all of them already expose one, confirmed in `apps/identity/src/index.ts:516` and accounting's `index.ts:69`).
- **Secrets audit**: confirm every secret in `docs/DEPLOYMENT_STATUS.md`'s tables is actually set in every environment (Phase 0's `RESEND_API_KEY` fix is a subset of this — do the rest too, including the new `ALLOWED_INVITE_DOMAINS` var from Ticket 0.2).
- **Document converter**: currently undeployed (`docs/DEPLOYMENT_STATUS.md`), CRM silently falls back to a weaker PDF extractor. Either deploy it (`apps/document-converter`, Docker/FastAPI, cheap on Render/Fly/Cloud Run) or explicitly drop PDF-import-quality from scope and update the docs so this stops looking like a silent bug.
- **Custom domain migration**: `docs/DOMAIN_MIGRATION_LATER.md` is already a ready-to-execute runbook — do this last, purely cosmetic/DX, no functional dependency on anything above.

---

## Sequencing summary

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4`, strictly in that order for 0→1 (Phase 1 needs Phase 0.3's real email delivery working first). Phase 2 (role dropdown) and Phase 3 (employee-portal gap-closing) don't depend on each other and can run in parallel once Phase 1 is stable, since neither touches shared auth internals. Phase 4 can interleave with 2/3 opportunistically (e.g. write tests for Phase 1 as part of Phase 1, don't defer all testing to the end) but the observability/domain/secrets-audit items are genuinely last.

## Decisions still needed from Abdullah before GLM starts (repeat of open questions above, collected here)

1. Allowed invite email domain(s): `skarion.com` only, or also `skarionengineering.com`? (Ticket 0.2)
2. TOTP's fate — drop it, keep as superadmin-only extra factor (recommended), or keep as-is for whoever's already enrolled? (Ticket 1.6)
3. Any known non-superadmin `books` users in production today who'll be locked out by Ticket 0.1 — expected, or a surprise to flag? (Ticket 0.1)
4. Phase 3, Ticket 3.2/3.3: confirm the recommended simpler permission models (symmetric edit/delete for any `hr` role, manager-only delete, salary hidden from `member` role) rather than something more granular — these are product calls, not technical ones.

**Already resolved during planning (don't re-ask):** SaaS scope is single-tenant/internal only, not multi-org. "Timekeeping" = the existing PTO/time-off + employee/department management in `apps/employee-portal`, no clock-in/out hours tracking needed. The `hr` app-enum value stays as-is, no rename.
