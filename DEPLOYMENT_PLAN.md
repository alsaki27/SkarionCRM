# SkarionCRM Deployment Plan — Chunkable Roadmap

> **Status**: Code fixes pushed to `main`.  
> **Repo**: `https://github.com/alsaki27/SkarionCRM`  
> **Architecture**: Cloudflare Pages (Frontend) + Neon (PostgreSQL) + Railway/Render/Fly.io (Backend)

---

## Executive Summary

The SkarionCRM monorepo has been completely fixed and pushed. Here's what was done:

| Area | Before | After |
|------|--------|-------|
| Dependencies | Drizzle version conflict (0.35 vs 0.45) | Unified to 0.45.2 |
| Server build | ❌ Broken schema + seed | ✅ Fixed seed, real AI, tests |
| Client build | ❌ tRPC any type, Tailwind missing shades, React Query v4 APIs | ✅ Full type safety, v5 APIs, complete Tailwind scales |
| AI | ❌ Placeholder mock data | ✅ Real OpenAI SDK with graceful fallback |
| Tests | ❌ None | ✅ 6 router test suites + stress test |
| Deployment | ❌ No configs | ✅ Docker, CI/CD, Cloudflare, Railway, Render, Fly.io |

---

## Chunk 1 — Database Setup (Neon) ⏱ ~15 min

### 1.1 Create Neon Project
1. Go to [neon.tech](https://neon.tech) → New Project
2. Choose region closest to your backend (e.g., `us-east-1` for Railway US)
3. Copy the connection string (looks like: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`)

### 1.2 Configure Environment
```bash
# In your repo root
cp .env.example .env
# Edit .env and set:
DATABASE_URL=postgresql://...your-neon-connection-string...
JWT_SECRET=your-super-secret-32-char-minimum-key
JWT_EXPIRES_IN=7d
NODE_ENV=production
APP_URL=https://your-frontend.pages.dev
API_URL=https://your-backend.railway.app
OPENAI_API_KEY=sk-...        # (Chunk 4)
OPENAI_MODEL=gpt-4o
RESEND_API_KEY=re_...        # (Chunk 5)
FROM_EMAIL=noreply@yourdomain.com
```

### 1.3 Run Migrations & Seed
```bash
npm install                    # or pnpm install
npm run db:generate            # generates migration files
npm run db:migrate             # applies migrations to Neon
npm run db:seed                # seeds demo data
```

### 1.4 Verify Database
```bash
# Check tables exist
npm run db:studio              # opens Drizzle Studio in browser
# Login with: admin@democompany.com / admin123
```

**Deliverable**: Live Neon database with all tables and demo data.

---

## Chunk 2 — Backend Deployment (Railway / Render / Fly.io / Docker) ⏱ ~20 min

### Option A: Railway (Recommended for speed)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link                    # select/create project
railway up                      # deploys using railway.json

# Set environment variables in Railway dashboard
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="..."
railway variables set OPENAI_API_KEY="..."
```

### Option B: Render

1. Push code to GitHub (already done)
2. Go to [render.com](https://render.com) → New Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` automatically
5. Add environment variables in dashboard

### Option C: Fly.io

```bash
# Install Fly CLI
brew install flyctl             # macOS
# or see https://fly.io/docs/hands-on/install-flyctl/

fly auth login
fly deploy                      # reads fly.toml
fly secrets set DATABASE_URL="..." JWT_SECRET="..." OPENAI_API_KEY="..."
```

### Option D: Docker (Local / VPS)

```bash
# Build and run locally
docker-compose up -d            # starts app + postgres locally

# Or build production image
docker build -t skarion-crm .
docker run -p 4000:4000 \
  -e DATABASE_URL="..." \
  -e JWT_SECRET="..." \
  skarion-crm
```

### Verify Backend
```bash
curl https://your-backend-url.railway.app/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Deliverable**: Live backend API with health endpoint responding.

---

## Chunk 3 — Frontend Deployment (Cloudflare Pages) ⏱ ~10 min

### 3.1 Build the Client
```bash
# Set your backend URL
cd client
# Create .env.production
echo "VITE_API_URL=https://your-backend.railway.app" > .env.production

# Build
npm run build
```

### 3.2 Deploy to Cloudflare Pages
1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com)
2. Create a new project → Connect to Git
3. Select `alsaki27/SkarionCRM`
4. Build settings:
   - **Build command**: `cd client && npm run build`
   - **Build output directory**: `client/dist`
   - **Root directory**: `/`
5. Environment variables:
   - `VITE_API_URL=https://your-backend.railway.app`
   - `NODE_VERSION=20`
6. Deploy

### 3.3 SPA Routing Fix
The `client/public/_redirects` file is already configured:
```
/* /index.html 200
```
This ensures React Router works on page refresh.

### 3.4 CORS Configuration
Make sure your backend `APP_URL` matches your Cloudflare Pages URL:
```bash
# In backend env
APP_URL=https://your-frontend.pages.dev
```

**Deliverable**: Live frontend at `https://your-project.pages.dev`

---

## Chunk 4 — AI Integration Setup ⏱ ~5 min

### 4.1 Get OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add payment method (set usage limits!)

### 4.2 Configure Backend
```bash
# Set on your backend platform
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
```

### 4.3 Test AI Endpoints
```bash
# Login first to get token
TOKEN=$(curl -X POST https://your-backend.railway.app/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"admin@democompany.com","password":"admin123"}}' \
  | jq -r '.result.data.token')

# Test AI document parsing
curl https://your-backend.railway.app/trpc/ai.parseDocument \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"json":{"fileContent":"Invoice #123 for $5000 from Acme Corp","fileType":"txt"}}'

# Test AI account suggestion
curl https://your-backend.railway.app/trpc/ai.suggestAccount \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"json":{"description":"Office rent payment","amount":3500}}'
```

### 4.4 Fallback Mode (No API Key)
If you don't have an OpenAI key yet, the AI endpoints return mock data with a warning message. The app works fully — just without AI insights.

**Deliverable**: AI endpoints responding with real or fallback data.

---

## Chunk 5 — Email & Storage Setup ⏱ ~10 min

### 5.1 Email (Resend)
1. Sign up at [resend.com](https://resend.com)
2. Verify a domain (or use `.onmicrosoft.com` for testing)
3. Get API key: `re_...`
4. Set backend env: `RESEND_API_KEY=re_...` and `FROM_EMAIL=noreply@yourdomain.com`

### 5.2 File Storage Options

**Option A: Supabase (current default)**
```bash
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

**Option B: Cloudflare R2 (recommended for Cloudflare stack)**
```bash
STORAGE_PROVIDER=cloudflare_r2
CLOUDFLARE_R2_BUCKET=skarion-uploads
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_ENDPOINT=...
```

**Option C: Local (development only)**
```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./uploads
```

**Deliverable**: Email sending and file uploads working.

---

## Chunk 6 — Custom Domain & SSL ⏱ ~15 min

### 6.1 Frontend Custom Domain
1. In Cloudflare Pages dashboard → Custom domains
2. Add your domain (e.g., `crm.yourcompany.com`)
3. Cloudflare automatically provisions SSL

### 6.2 Backend Custom Domain
If using Railway:
1. In Railway dashboard → Settings → Domains
2. Add custom domain
3. Create CNAME in Cloudflare DNS pointing to Railway domain

### 6.3 Update Environment Variables
```bash
# Frontend build
VITE_API_URL=https://api.crm.yourcompany.com

# Backend
APP_URL=https://crm.yourcompany.com
API_URL=https://api.crm.yourcompany.com
```

**Deliverable**: App running on your own domain with SSL.

---

## Chunk 7 — Monitoring, Backups & Security ⏱ ~10 min

### 7.1 Health Monitoring
- **Health endpoint**: `GET /health` returns `{status: "ok", timestamp: "..."}`
- Set up UptimeRobot or Pingdom to ping `/health` every 5 minutes
- Configure alerts for 5xx errors

### 7.2 Backups (Neon)
- Neon automatically backs up daily
- For point-in-time recovery: Neon Pro plan required
- Export dumps manually: `pg_dump $DATABASE_URL > backup.sql`

### 7.3 Security Checklist
- [ ] `JWT_SECRET` is 32+ random characters
- [ ] Database is SSL-only (Neon default)
- [ ] Backend CORS allows only your frontend domain
- [ ] API keys (OpenAI, Resend) are in backend env only, never in frontend
- [ ] `NODE_ENV=production` on backend
- [ ] Passwords hashed with bcrypt (already implemented)
- [ ] Audit logs enabled for all data mutations

### 7.4 Rate Limiting (Optional)
Add `express-rate-limit` to `server/src/index.ts` if you expect high traffic:
```bash
npm install express-rate-limit
```

**Deliverable**: Production-hardened deployment.

---

## Chunk 8 — CI/CD Automation ⏱ ~5 min

### 8.1 GitHub Actions (Already Configured)
The `.github/workflows/ci.yml` runs on every push:
```yaml
- lint
- typecheck
- build
- test
```

### 8.2 Auto-Deploy on Push
Connect your deployment platform to GitHub:
- **Railway**: Auto-deploys on push to `main`
- **Render**: Auto-deploys on push to `main`
- **Cloudflare Pages**: Auto-deploys on push to `main`

### 8.3 Branch Protection
In GitHub repo settings:
1. Enable branch protection for `main`
2. Require PR reviews
3. Require CI checks to pass before merge

**Deliverable**: Push-to-deploy pipeline.

---

## Chunk 9 — Stress Testing ⏱ ~5 min

### 9.1 Run the Stress Test
```bash
cd server
npx tsx src/test/stress-test.ts
```

This tests:
- 100 contacts created rapidly
- 100 transactions
- 50 invoices with lines
- 50 employees
- 50 parallel requests
- AI endpoints

### 9.2 Expected Output
```
=== Stress Test Results ===
{
  contacts: { passed: 100, failed: 0 },
  transactions: { passed: 100, failed: 0 },
  invoices: { passed: 50, failed: 0 },
  employees: { passed: 50, failed: 0 },
  parallel: { passed: 50, failed: 0 },
  ai: { status: 'OK' }
}
```

### 9.3 Manual Feature Testing Checklist
- [ ] Register new organization
- [ ] Login / logout
- [ ] Create contact (client, vendor, employee)
- [ ] Create chart of accounts
- [ ] Record transaction
- [ ] Create and send invoice
- [ ] Record payment against invoice
- [ ] Create employee and run payroll
- [ ] Generate W2 preview
- [ ] Create compliance item and mark complete
- [ ] Upload document
- [ ] Create task and assign
- [ ] Use AI to parse document
- [ ] Use AI to suggest account code
- [ ] Timekeeping: clock in/out, submit timesheet
- [ ] PTO: request leave, approve leave
- [ ] Reports: P&L, Balance Sheet, Cash Flow

**Deliverable**: All features verified working.

---

## Chunk 10 — Post-Launch Maintenance ⏱ Ongoing

### 10.1 Regular Updates
```bash
# Monthly dependency updates
npm outdated
npm update

# Security audits
npm audit
npm audit fix
```

### 10.2 Database Migrations
```bash
# After schema changes
npm run db:generate
npm run db:migrate
```

### 10.3 Log Monitoring
Backend logs via Winston (already configured). Check logs on your deployment platform dashboard.

### 10.4 Scaling
- **Neon**: Enable autoscaling in dashboard
- **Railway**: Scale to multiple instances
- **Cloudflare Pages**: Automatic edge scaling

---

## Quick Reference: Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=...                    # min 32 chars
PORT=4000
NODE_ENV=production
APP_URL=https://your-frontend.pages.dev
API_URL=https://your-backend.railway.app

# AI (optional but recommended)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Email (optional)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

# Storage (pick one)
STORAGE_PROVIDER=supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# Or local
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./uploads
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                             │
│                 https://crm.yoursite.com                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages (Frontend)                     │
│              React + Vite + Tailwind + tRPC                  │
│              Static assets at 275+ edge locations           │
└────────────────────┬────────────────────────────────────────┘
                     │  API calls (HTTPS / Bearer JWT)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Railway / Render / Fly.io (Backend)             │
│              Node.js + Express + tRPC                        │
│              Drizzle ORM + OpenAI SDK                        │
└────────────────────┬────────────────────────────────────────┘
                     │  SQL queries (SSL)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Neon (PostgreSQL)                               │
│              Serverless Postgres                             │
│              Auto-scaling, daily backups                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Support & Next Steps

1. **Test the build locally first**: `npm run build` in both `client/` and `server/`
2. **Deploy Chunk 1 (DB) first**, then Chunk 2 (backend), then Chunk 3 (frontend)
3. **Get your OpenAI key** before Chunk 4 for full AI functionality
4. **Run stress tests** after each chunk deployment
5. **Open issues** on the GitHub repo if anything breaks

**Total estimated time**: ~1.5 hours to full production deployment.

Good luck with the launch! 🚀
