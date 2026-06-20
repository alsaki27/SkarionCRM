# Skarion CRM - Deployment Status

Last updated: 2026-06-21

## Production URLs (Cloudflare Default)

| Service | Type | URL | Status |
|---------|------|-----|--------|
| CRM Frontend | Cloudflare Pages | `https://skarion-crm.pages.dev` | ✅ Deployed |
| CRM Worker/API | Cloudflare Worker | `https://skarion-crm-platform.alsaki1999.workers.dev` | ✅ Deployed |
| Identity Worker/API | Cloudflare Worker | `https://skarion-identity.alsaki1999.workers.dev` | ✅ Deployed |
| Identity Login Pages | Cloudflare Pages | `https://skarion-identity-login.pages.dev` | ⚠️ Created, 0 deployments |
| Identity Admin Pages | Cloudflare Pages | `https://skarion-identity-admin.pages.dev` | ⚠️ Created, 0 deployments |
| Embeddings Builder | Cloudflare Worker | `https://skarion-embeddings-builder.alsaki1999.workers.dev` | ❌ Not deployed |
| Workflow Runner | Cloudflare Worker | `https://skarion-workflow-runner.alsaki1999.workers.dev` | ❌ Not deployed |
| Cron Worker | Cloudflare Worker | `https://skarion-cron.alsaki1999.workers.dev` | ❌ Not deployed |
| Email Inbound | Cloudflare Worker | `https://skarion-email-inbound.alsaki1999.workers.dev` | ❌ Not deployed |

## Old Workers (Still Exist, Not Used)

- `skarion-crm-api` (old monolith architecture)
- `skarionwebsite` (old website)

## GitHub Actions Workflows

| Workflow | File | Trigger | Deploys |
|----------|------|---------|---------|
| Deploy CRM | `.github/workflows/deploy-crm.yml` | push `main` + `workflow_dispatch` | CRM Worker + migrations |
| Deploy Identity | `.github/workflows/deploy-identity.yml` | push `main` + `workflow_dispatch` | Identity Worker + Login Pages + Admin Pages + migrations |
| Deploy Embeddings Builder | `.github/workflows/deploy-embeddings-builder.yml` | push `main` + `workflow_dispatch` | Embeddings Builder Worker |
| Deploy Workflow Runner | `.github/workflows/deploy-workflow-runner.yml` | push `main` + `workflow_dispatch` | Workflow Runner Worker |
| Deploy Cron | `.github/workflows/deploy-cron.yml` | push `main` + `workflow_dispatch` | Cron Worker |
| Deploy Email Inbound | `.github/workflows/deploy-email-inbound.yml` | push `main` + `workflow_dispatch` | Email Inbound Worker |

## Required GitHub Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `CLOUDFLARE_API_TOKEN` | All workflows | Cloudflare API token with Workers + Pages edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | All workflows | Cloudflare account ID |
| `DATABASE_URL` | CRM, Identity, Embeddings, Workflow Runner, Email Inbound | Neon PostgreSQL connection string |
| `JWT_SECRET` | CRM, Identity | HS256 signing key for JWTs |
| `GOOGLE_API_KEY` | CRM, Embeddings Builder | Google Gemini API key |
| `GOOGLE_CHAT_MODEL` | CRM | Gemini chat model (default: `gemini-1.5-flash`) |
| `GOOGLE_EMBEDDING_MODEL` | CRM, Embeddings Builder | Gemini embedding model (default: `embedding-001`) |
| `RESEND_API_KEY` | Identity, Email Inbound | Resend email API key |
| `MFA_ENCRYPTION_KEY` | Identity | Encryption key for MFA secrets |
| `INVITATION_TOKEN_PEPPER` | Identity | Pepper for invitation token hashing |
| `WORKFLOW_RUNNER_SECRET` | Cron, Workflow Runner | Shared secret for cron→workflow-runner auth |

## Required GitHub Variables (Not Secrets)

| Variable | Used By | Description |
|----------|---------|-------------|
| `IDENTITY_API_URL` | Identity Pages build | Identity worker URL for VITE_IDENTITY_API_URL |

## Cloudflare Pages Environment Variables

Set in Cloudflare dashboard for each Pages project:

| Project | Var | Value |
|---------|-----|-------|
| `skarion-crm` | `VITE_API_URL` | `https://skarion-crm-platform.alsaki1999.workers.dev` |
| `skarion-crm` | `VITE_IDENTITY_API_URL` | `https://skarion-identity.alsaki1999.workers.dev` |
| `skarion-identity-login` | `VITE_IDENTITY_API_URL` | `https://skarion-identity.alsaki1999.workers.dev` |
| `skarion-identity-admin` | `VITE_IDENTITY_API_URL` | `https://skarion-identity.alsaki1999.workers.dev` |

## Cloudflare Worker Secrets (Set via Wrangler)

After deployment, secrets are pushed via GitHub Actions. Manual fallback:

```bash
cd apps/crm && wrangler secret put DATABASE_URL
cd apps/crm && wrangler secret put JWT_SECRET
cd apps/crm && wrangler secret put GOOGLE_API_KEY
cd apps/identity && wrangler secret put DATABASE_URL
cd apps/identity && wrangler secret put JWT_SECRET
cd apps/identity && wrangler secret put RESEND_API_KEY
cd apps/identity && wrangler secret put MFA_ENCRYPTION_KEY
cd apps/identity && wrangler secret put INVITATION_TOKEN_PEPPER
cd apps/workers/embeddings-builder && wrangler secret put DATABASE_URL
cd apps/workers/embeddings-builder && wrangler secret put GOOGLE_API_KEY
cd apps/workers/workflow-runner && wrangler secret put DATABASE_URL
cd apps/workers/workflow-runner && wrangler secret put WORKFLOW_RUNNER_SECRET
cd apps/workers/cron && wrangler secret put WORKFLOW_RUNNER_SECRET
cd apps/workers/email-inbound && wrangler secret put DATABASE_URL
cd apps/workers/email-inbound && wrangler secret put RESEND_API_KEY
```

## Manual Deploy Commands

```bash
# CRM Worker
cd apps/crm && wrangler deploy

# CRM Pages (via GitHub integration, or manual)
cd apps/crm/web && pnpm build && wrangler pages deploy dist

# Identity Worker
cd apps/identity && wrangler deploy

# Identity Login Pages
cd apps/identity/login && pnpm build && wrangler pages deploy dist

# Identity Admin Pages
cd apps/identity/admin && pnpm build && wrangler pages deploy dist

# Embeddings Builder
cd apps/workers/embeddings-builder && wrangler deploy

# Workflow Runner
cd apps/workers/workflow-runner && wrangler deploy

# Cron
cd apps/workers/cron && wrangler deploy

# Email Inbound
cd apps/workers/email-inbound && wrangler deploy
```

## Migrations

```bash
# CRM schema
cd apps/crm && DATABASE_URL=... pnpm db:migrate

# Identity schema
cd apps/identity && DATABASE_URL=... pnpm db:migrate
```

## Smoke Test

```bash
# Set env vars, then run:
ADMIN_EMAIL=admin@skarion.com ADMIN_PASSWORD=changeme-now npx tsx scripts/smoke-production.ts

# Or with custom URLs:
CRM_URL=https://skarion-crm-platform.alsaki1999.workers.dev \
  IDENTITY_URL=https://skarion-identity.alsaki1999.workers.dev \
  ADMIN_EMAIL=admin@skarion.com \
  ADMIN_PASSWORD=changeme-now \
  npx tsx scripts/smoke-production.ts
```

## Admin Seed

```bash
cd apps/identity
DATABASE_URL=... npx tsx src/scripts/seed-admin.ts
```

## Current Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Identity Pages not deployed | Login/admin UIs not accessible | Trigger GitHub Actions deploy-identity workflow |
| Embeddings builder not deployed | No auto-embeddings for RAG | Trigger deploy-embeddings-builder workflow |
| Workflow runner not deployed | Workflow rules don't execute | Trigger deploy-workflow-runner workflow |
| Cron not deployed | Time-based rules don't run | Trigger deploy-cron workflow |
| Email inbound not deployed | No email processing | Trigger deploy-email-inbound workflow |
| GOOGLE_API_KEY not set | AI chat returns fallback message | Set secret in CRM + Embeddings workers |
| No admin user seeded | Cannot log in | Run seed-admin.ts script |

## AI Setup Status

| Feature | Status | Notes |
|---------|--------|-------|
| AI Chat endpoint | ✅ Backend ready | Needs GOOGLE_API_KEY |
| AI Widget | ✅ Frontend ready | Floating widget in AppShell |
| RAG / Embeddings | ✅ Backend ready | Needs embeddings-builder deployed + GOOGLE_API_KEY |
| Lead summarization | ✅ Ready | Endpoint + UI on lead detail page |
| Outreach drafting | ✅ Ready | Endpoint + UI on lead detail page |
| Lead scoring | ✅ Ready | Endpoint + UI on lead detail page |
| Next action suggestion | ✅ Ready | Endpoint + UI on lead detail page |
| Company/Contact summary | ✅ Ready | Endpoints ready |
| PDF-to-lead import | ✅ Ready | Backend + frontend modal ready |

## Feature Checklist

| Feature | Status |
|---------|--------|
| Auth (login/logout/refresh) | ✅ |
| Role-based permissions | ✅ |
| Companies CRUD | ✅ |
| Contacts CRUD | ✅ |
| Leads CRUD + pipeline | ✅ |
| Opportunities CRUD | ✅ |
| Tasks + completion | ✅ |
| Activities timeline | ✅ |
| CSV import | ✅ |
| PDF import | ✅ |
| AI chat widget | ✅ |
| AI summarization | ✅ |
| AI outreach drafting | ✅ |
| AI lead scoring | ✅ |
| AI next action | ✅ |
| Workflow rules | ✅ |
| Integrations config | ✅ |
| Audit log | ✅ |
| Email stubs | ✅ (not wired to Resend) |
| MFA | ✅ (backend ready) |
| Invitations | ✅ (backend ready) |

## Custom Domain Migration

See [DOMAIN_MIGRATION_LATER.md](./DOMAIN_MIGRATION_LATER.md) for the planned custom domain mapping.

## Notes

- All services use Cloudflare default URLs (`*.workers.dev`, `*.pages.dev`) for production validation.
- No feature depends on `skarion.com` DNS.
- Custom domain migration is documented but postponed.
- `pnpm typecheck` and `pnpm lint` must pass before every commit.
