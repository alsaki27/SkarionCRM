# Instructions for Kimi: close out remaining gaps, then Chunk 5 (AI Chatbot/RAG)

Pull `cloudflare-platform-rewrite` first. Confirm `pnpm typecheck`
(23/23) and `pnpm lint` (18/18) pass clean. Includes Claude's fix
(`9bab645`) for a real security regression found in your role-model push
— read section 1 before anything else.

## 0. Audit of your last push (role model, Section 4)

Real, solid work. `isSuperadmin` is now a global flag on `identity.users`
(migration generated correctly), it's in the JWT, `requireAppRole`/
`requireSuperadmin` in `@skarion/auth-client` correctly short-circuit for
superadmins, `packages/permissions`'s `can()`/`canList()` collapsed
cleanly to `manager`/`member`, and every call site in
`apps/crm/src/index.ts` was updated consistently. `apps/identity/admin`'s
`AuthContext.tsx`/`App.tsx` correctly gate the whole admin app on the
real `isSuperadmin` flag. Bonus: you also shipped the Pipeline Kanban
board (3.7) and CSV import UI, ahead of what was asked.

## 1. Fixed for you, understand why (don't reintroduce)

`apps/identity/src/index.ts`'s `isAllowedOrigin()` had been widened to
match **any** `https://*.pages.dev` or `https://*.workers.dev` origin.
Both are shared, multi-tenant domains — anyone with a Cloudflare account
can deploy to `<anything>.pages.dev`. Combined with `credentials: true`
on the CORS middleware, this let any other tenant's site make
credentialed cross-origin requests against this API and read the
response via standard CORS (not just CSRF) — e.g. a malicious
`evil.pages.dev` page could call `/me` for a logged-in victim and read
their session data. This was very likely an attempt to work around
`auth.skarion.com` not having real DNS yet (still true — see section 2)
rather than a deliberate choice, but it's a real vulnerability either
way. Replaced with an explicit allowlist
(`ALLOWED_PAGES_WORKERS_ORIGINS`) of this project's actual known origins.
**If you add a new Pages/Worker project, add its exact origin to that
set — never widen the pattern back to a domain-wide wildcard.**

## 2. Still not done — these need real attention

### 2a. `main` branch is still being actively worked on

The last instructions said stop committing to `main`/`cloudflare-deploy`.
Since then, `main` got 5 more commits (readiness health checks, CI
alignment, request ID middleware, rate limiting, security headers).
Either this instruction didn't reach whoever's doing this, or it's being
treated as optional. **Abdullah needs to confirm directly who/what is
still pushing to `main`** — Claude can't tell from the repo alone whether
it's you, another process, or Abdullah himself. Don't guess; ask him
before doing anything else there.

### 2b. `auth.skarion.com` still doesn't exist in DNS, deploy-identity.yml still failing

Re-confirmed both, unchanged since last audit: `nslookup auth.skarion.com`
still returns `Non-existent domain`, and the last 3 runs of
`deploy-identity.yml` all failed. This needs the actual Cloudflare
dashboard work described in the last handover doc (attach a Custom
Domain to the identity Worker, create the two missing Pages projects).
If you don't have Cloudflare dashboard access to do this yourself, say
so explicitly to Abdullah rather than letting it sit — this blocks real
login working in production, it's not a nice-to-have.

### 2c. New gap found this session: CRM frontend's nav ignores `isSuperadmin`

`apps/crm/web/src/components/layout/AppShell.tsx`'s `visibleNav` filters
`NAV_ITEMS` by `role` (a string from `apps.crm`) only. A pure global
superadmin who has **no** `crm` app-membership row at all gets
`role: ''` from `bootstrapAuth()` (`apps/crm/web/src/api.ts`, which only
reads `data.user.apps?.crm`) — `''` matches nothing in any `roles` array,
so **that superadmin sees a completely empty sidebar**, even though the
backend correctly grants them full API access. This directly undermines
"superadmin has access to everything" at the one layer that actually
matters for a human using the product. Fix: `bootstrapAuth()` needs to
also capture `isSuperadmin` from the refresh response and store it on the
auth store; `AppShell`'s nav-filtering logic should show everything when
`isSuperadmin` is true, the same way `identity/admin`'s `App.tsx` already
does it correctly.

**Validate before moving on:** log in (or simulate via a throwaway
script) as a user with `isSuperadmin = true` and zero `crm` app
memberships, confirm the CRM frontend shows the full nav and every page
loads — not just that the API allows it.

## 3. Chunk 5 — AI Chatbot / RAG

Once 1–2c are addressed (2a/2b may be blocked on Abdullah/Cloudflare
access — don't let that block 2c or Chunk 5 itself, just don't mark them
done). This is a reconstruction, not verbatim original spec text — if
Abdullah still has the real Chunk 5 spec, defer to it over anything here
that conflicts.

### 5.1 — Embeddings + retrieval foundation

`apps/workers/embeddings-builder` already exists as a stub — this is
where it gets built out. Pick one embedding provider (check what AI
provider keys already exist — identity's `RESEND_API_KEY`/
`MFA_ENCRYPTION_KEY` pattern for secrets applies the same way here:
`OPENAI_API_KEY` or similar, confirm with Abdullah which provider before
hardcoding one). Schema: a `crm.embeddings` table (or per-entity, your
call) storing `resourceType`, `resourceId`, `embedding` (vector column —
check what Postgres extension Neon supports for vector storage; `pgvector`
is the standard, confirm it's available on the Neon plan in use before
committing to it), `content` (the text that was embedded), `updatedAt`.
A Worker cron or queue consumer that (re)embeds CRM records on
create/update — companies, contacts, leads, opportunities, activities,
notes are the obvious candidates for RAG context.

### 5.2 — Chat API

A new endpoint (`apps/crm` or a dedicated chat Worker — your call, but
don't duplicate identity's auth pattern, import `requireAuth` from
`@skarion/auth-client` same as everywhere else) that: takes a user
message, does a similarity search against 5.1's embeddings scoped to
records the caller can actually see (`canList()` from
`@skarion/permissions` — a non-superadmin chatting shouldn't get RAG
context pulled from records they don't have permission to view), builds
a prompt with that context, calls the LLM, returns the response.
Streaming (SSE or similar) if the chosen LLM provider supports it and the
frontend can consume it — check before committing to non-streaming if
response latency matters.

### 5.3 — Chat UI

A chat panel in `apps/crm/web` (slide-out panel or dedicated `/chat`
route — match whatever existing nav/layout conventions `AppShell.tsx`
already has). Message history persisted per-user (a `crm.chat_messages`
table) so a page refresh doesn't lose context mid-conversation.

### 5.4 — Permission-aware answers

The chat must never answer with information the asking user couldn't
see through the regular API. This is the same `can()`/`canList()`
enforcement as every other entity — apply it at the retrieval step
(5.2), not just trust the LLM to behave. Test this explicitly: ask the
chat about a record owned by a different non-managed user as a `member`-
role caller, confirm it correctly can't surface that record's details.

### Validation discipline (same as every chunk)

`pnpm typecheck` + `pnpm lint` clean across the whole repo for every
ticket. For the embeddings/chat API work, a real validation script
against a database with actual embedded records, confirming retrieval
returns the right records and respects permission scoping — not just
"the LLM call succeeded." Push incrementally to
`cloudflare-platform-rewrite` only.
