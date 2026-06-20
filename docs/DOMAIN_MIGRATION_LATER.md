# Domain Migration Plan (Postponed)

This document tracks how Skarion CRM will migrate from Cloudflare default URLs (`*.workers.dev`, `*.pages.dev`) to custom `skarion.com` domains. This is **intentionally postponed** — the app is fully usable on default URLs now.

## Current State

All services run on Cloudflare default URLs. No feature depends on `skarion.com` DNS.

## Target Custom Domains

| Service | Current URL | Target Custom Domain | Cloudflare Product |
|---------|-------------|---------------------|-------------------|
| CRM Frontend | `skarion-crm.pages.dev` | `crm.skarion.com` | Cloudflare Pages Custom Domain |
| Identity Login Frontend | `skarion-identity-login.pages.dev` | `login.skarion.com` or `auth.skarion.com/login` | Cloudflare Pages Custom Domain |
| Identity Admin Frontend | `skarion-identity-admin.pages.dev` | `admin.skarion.com` or `auth.skarion.com/admin` | Cloudflare Pages Custom Domain |
| CRM API / Worker | `skarion-crm-platform.alsaki1999.workers.dev` | `api.crm.skarion.com` | Cloudflare Worker Custom Domain |
| Identity API / Worker | `skarion-identity.alsaki1999.workers.dev` | `auth.skarion.com` or `api.auth.skarion.com` | Cloudflare Worker Custom Domain |
| Embeddings Builder | `skarion-embeddings-builder.alsaki1999.workers.dev` | No custom domain needed (internal only) | — |
| Workflow Runner | `skarion-workflow-runner.alsaki1999.workers.dev` | No custom domain needed (internal only) | — |
| Cron | `skarion-cron.alsaki1999.workers.dev` | No custom domain needed (internal only) | — |
| Email Inbound | `skarion-email-inbound.alsaki1999.workers.dev` | No custom domain needed (internal only) | — |

## Prerequisites

1. **Transfer `skarion.com` to this Cloudflare account** (or add it as a zone)
   - Currently `skarion.com` is NOT on this Cloudflare account
   - Only `skarionengineering.com` is available
   - Alternative: Use `skarionengineering.com` as the custom domain instead

2. **Update DNS records** for each subdomain to point to Pages/Worker

3. **Update CORS origin checks** in CRM and Identity workers to include `*.skarion.com`

4. **Update `APP_URL` env vars** in wrangler.toml files

5. **Update `VITE_API_URL` / `VITE_IDENTITY_API_URL`** in Pages build env vars

6. **Update `WORKFLOW_RUNNER_URL` / `CRM_API_URL`** in worker wrangler.toml files

7. **Re-deploy all services** after config changes

## Migration Steps (When Ready)

### Step 1: Add `skarion.com` to Cloudflare Account

```bash
# Via Cloudflare dashboard or API
# Add skarion.com as a zone in the current account
```

### Step 2: Update CRM Worker

```toml
# apps/crm/wrangler.toml
[vars]
APP_URL = "https://crm.skarion.com"

[env.staging.vars]
APP_URL = "https://crm-staging.skarion.com"
```

Update CORS origin check:
```typescript
// Allow *.skarion.com in addition to current defaults
if (origin.endsWith('.skarion.com')) return true;
```

### Step 3: Update Identity Worker

```toml
# apps/identity/wrangler.toml
[vars]
APP_URL = "https://auth.skarion.com"

[env.staging.vars]
APP_URL = "https://auth-staging.skarion.com"
```

Update `appUrlFor` function to derive `crm.skarion.com` from `auth.skarion.com`:
```typescript
// Already works — the function splits on .skarion.com and replaces subdomain
```

### Step 4: Update Pages Projects Custom Domains

| Project | Custom Domain | Setup |
|---------|-------------|-------|
| `skarion-crm` | `crm.skarion.com` | Pages → Custom Domains → Add |
| `skarion-identity-login` | `login.skarion.com` or `auth.skarion.com` | Pages → Custom Domains → Add |
| `skarion-identity-admin` | `admin.skarion.com` or `auth.skarion.com` | Pages → Custom Domains → Add |

### Step 5: Update Worker Custom Domains

| Worker | Custom Domain | Setup |
|--------|-------------|-------|
| `skarion-crm-platform` | `api.crm.skarion.com` | Workers → Triggers → Custom Domains |
| `skarion-identity` | `auth.skarion.com` or `api.auth.skarion.com` | Workers → Triggers → Custom Domains |

### Step 6: Update GitHub Actions / Build Vars

```yaml
# .github/workflows/deploy-identity.yml
env:
  VITE_IDENTITY_API_URL: "https://auth.skarion.com"
```

```yaml
# .github/workflows/deploy-crm.yml (Pages env vars)
# Set in Cloudflare dashboard:
# VITE_API_URL=https://api.crm.skarion.com
# VITE_IDENTITY_API_URL=https://auth.skarion.com
```

### Step 7: Update Cross-Worker URLs

```toml
# apps/workers/workflow-runner/wrangler.toml
[vars]
CRM_API_URL = "https://crm.skarion.com"

# apps/workers/cron/wrangler.toml
[vars]
WORKFLOW_RUNNER_URL = "https://skarion-workflow-runner.alsaki1999.workers.dev"
# (internal workers can stay on workers.dev)
```

### Step 8: Re-deploy Everything

Trigger all GitHub Actions workflows or manually deploy.

### Step 9: Verify

1. `crm.skarion.com` loads CRM frontend
2. `auth.skarion.com` loads identity login
3. `admin.skarion.com` loads identity admin
4. `api.crm.skarion.com` responds to API calls
5. Cross-origin cookies work (same root domain: `.skarion.com`)
6. Auth redirect flow works end-to-end

## Alternative: Use `skarionengineering.com`

If `skarion.com` cannot be transferred, the same migration plan applies to `skarionengineering.com`:

| Service | Target |
|---------|--------|
| CRM Frontend | `crm.skarionengineering.com` |
| Identity Login | `auth.skarionengineering.com` |
| Identity Admin | `admin.skarionengineering.com` |
| CRM API | `api.crm.skarionengineering.com` |

## Notes

- Keep `*.skarion.com` in CORS allowlists even after migration (for staging subdomains)
- The `skarionengineering.com` zone is already on this account — can be used immediately
- Custom domains are a cosmetic/UX improvement, not a functional requirement
- All features work correctly on `*.workers.dev` and `*.pages.dev` URLs
