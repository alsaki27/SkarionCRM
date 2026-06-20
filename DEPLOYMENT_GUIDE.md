# SkarionCRM Deployment Guide

This guide covers deploying the SkarionCRM monorepo to production using Neon, Cloudflare Pages, and a Node.js backend platform (Railway, Render, Fly.io, or Docker).

---

## Table of Contents

1. [Database Setup (Neon)](#1-database-setup-neon)
2. [Backend Deployment](#2-backend-deployment)
3. [Frontend Deployment (Cloudflare Pages)](#3-frontend-deployment-cloudflare-pages)
4. [AI Setup](#4-ai-setup)
5. [Domain & SSL](#5-domain--ssl)
6. [Monitoring & Health](#6-monitoring--health)
7. [Backup & Security](#7-backup--security)

---

## 1. Database Setup (Neon)

[Neon](https://neon.tech) provides serverless PostgreSQL with branching, autoscaling, and generous free tiers.

### Steps

1. **Create a Neon project**
   - Go to [https://console.neon.tech](https://console.neon.tech) and sign up / log in.
   - Click **New Project**.
   - Choose a region close to your backend (e.g., `us-east-1` for Railway/Vercel, `us-east-2` for Fly.io IAD).
   - Name the project `skarion-crm`.

2. **Get the connection string**
   - In the Neon dashboard, go to the **Connection Details** tab.
   - Select the ** pooled connection** string (recommended for serverless) or the **direct connection** string.
   - Copy the connection string. It looks like:
     ```
     postgresql://user:password@host.neon.tech:5432/skarion?sslmode=require
     ```

3. **Set `DATABASE_URL` in environment**
   - Add the copied connection string to your backend environment variables as `DATABASE_URL`.
   - For local testing, you can add it to `.env`:
     ```env
     DATABASE_URL=postgresql://user:password@host.neon.tech:5432/skarion?sslmode=require
     ```

4. **Run migrations**
   - Ensure the `DATABASE_URL` is set, then run:
     ```bash
     npm run db:migrate
     ```
   - This applies all pending migrations in `server/migrations/` to the Neon database.

5. **Run seed data (optional)**
   - To populate the database with initial data:
     ```bash
     npm run db:seed
     ```
   - Review `server/src/db/seed.ts` before running to ensure it matches your needs.

> **Tip:** Neon automatically enables SSL (`sslmode=require`). Ensure your database client supports it (most modern libraries do by default).

---

## 2. Backend Deployment

Choose one of the following platforms. The backend is a standard Node.js/Express server compiled from TypeScript.

### Required Environment Variables for Backend

```env
DATABASE_URL=postgresql://user:password@host.neon.tech:5432/skarion?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=production
APP_URL=https://your-frontend-url.pages.dev
API_URL=https://your-backend-url.railway.app
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_MODEL=gpt-4o
RESEND_API_KEY=re_xxxxxxxx
FROM_EMAIL=noreply@skarion.com
# Required to use Settings -> AI Providers (admin-managed AI keys, encrypted at rest).
# Generate with: openssl rand -base64 32. Without it, admins can still configure AI
# via the OPENAI_API_KEY/KIMI_API_KEY/OLLAMA_URL env vars above, just not from the UI.
AI_KEYS_ENCRYPTION_SECRET=
```

### Option A: Railway (Recommended for Beginners)

1. Install the Railway CLI: `npm install -g @railway/cli`
2. Log in: `railway login`
3. In the repo root, run: `railway init` (or link to an existing project)
4. Push your code: `railway up`
5. In the Railway dashboard, go to **Variables** and add all required env vars.
6. Add a **Neon** database service from the Railway marketplace, or paste your `DATABASE_URL` manually.
7. Railway will automatically build and deploy using the `railway.json` configuration.

### Option B: Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Use the following settings:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start`
5. In **Environment Variables**, add all required env vars.
6. Render will detect the `render.yaml` in the repo if you choose **Blueprints** during creation.
7. The database will be provisioned automatically if you use the Blueprint.

### Option C: Fly.io

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Log in: `fly auth login`
3. In the repo root, run: `fly launch` (or `fly deploy` if already configured)
4. The `fly.toml` in this repo already defines the app configuration.
5. Set secrets via the CLI:
   ```bash
   fly secrets set DATABASE_URL="postgresql://..." JWT_SECRET="..." OPENAI_API_KEY="..."
   ```
6. Fly.io will build the Docker image and deploy to the `iad` region.

### Option D: Docker (Self-Hosted / VPS)

1. Ensure Docker and Docker Compose are installed.
2. Copy `.env.example` to `.env` and fill in production values.
3. Build and start:
   ```bash
   docker-compose up -d --build
   ```
4. The app will be available on `http://localhost:4000` (or your VPS IP).
5. The Postgres container will persist data in the `postgres_data` Docker volume.

> **Note:** For production Docker deployments, replace the `db` service in `docker-compose.yml` with a managed database (Neon, AWS RDS, etc.) for reliability.

---

## 3. Frontend Deployment (Cloudflare Pages)

[Cloudflare Pages](https://pages.cloudflare.com) offers fast global CDN, automatic SSL, and generous free tiers.

### Steps

1. **Build the client**
   ```bash
   cd client && npm run build
   ```
   - This produces static assets in `client/dist/`.

2. **Deploy to Cloudflare Pages**
   - Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → **Pages** → **Create a project**.
   - Connect your GitHub repository.
   - Use the following build settings:
     - **Build command:** `cd client && npm run build`
     - **Build output directory:** `client/dist`
   - Or, if you prefer the CLI:
     ```bash
     npm install -g wrangler
     wrangler pages deploy client/dist --project-name=skarion-crm
     ```

3. **Set environment variables in Cloudflare Pages**
   - In the Pages dashboard, go to **Settings** → **Environment variables**.
   - Add:
     ```env
     VITE_API_URL=https://your-backend-url.railway.app
     ```
   - This tells the frontend where to send API requests.

4. **SPA Routing**
   - The `client/public/_redirects` file is already configured:
     ```
     /* /index.html 200
     ```
   - Cloudflare Pages will automatically pick this up from the `dist/` folder during build, ensuring all routes serve the React SPA.

---

## 4. AI Setup

SkarionCRM supports OpenAI, Kimi/Moonshot, and Ollama for AI-powered features, plus an
admin-managed key manager at **Settings -> AI Providers** so admins can add/rotate keys
from the UI without redeploying. Resolution order: env vars first (OPENAI_API_KEY, then
KIMI_API_KEY, then OLLAMA_URL), then the highest-priority enabled DB-managed key.

### OpenAI (Production Recommended)

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Create a new API key.
3. Set the following environment variables in your backend:
   ```env
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   OPENAI_MODEL=gpt-4o
   ```
   - Supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`.
4. Test AI endpoints via the API (e.g., `POST /api/ai/summarize`) using a tool like Postman or curl.

### Ollama (Local / Self-Hosted)

1. Install Ollama: [https://ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3.2`
3. Ensure Ollama is running locally (default: `http://localhost:11434`).
4. Set the backend environment variables:
   ```env
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```
5. Leave `OPENAI_API_KEY` empty to fallback to Ollama.

> **Note:** Ollama is suitable for local development or if you have a GPU-enabled server. For production, OpenAI is recommended for reliability and speed.

### Admin-Managed Keys (Settings -> AI Providers)

1. Set `AI_KEYS_ENCRYPTION_SECRET` in the backend environment (required — the page returns
   a clear error if it's missing rather than silently failing).
2. Log in as an owner/admin and go to **Settings -> AI Providers**.
3. Add a key (OpenAI, Kimi, Ollama, OpenRouter, or DeepSeek), set its priority, and click
   **Test** to confirm it works. Full keys are never shown again after saving — only a
   fingerprint (first 6 + last 4 characters).
4. The chat assistant and other AI features automatically use these as a fallback if no
   env-configured provider is set.

### Chat Assistant Data Access

The floating chat assistant (bottom-right, all authenticated pages) has role-scoped tool
access enforced **server-side** in `server/src/routers/chat.ts`:
- **owner / admin / accountant / bookkeeper** get read-only tools across invoices,
  transactions, compliance, headcount, and payroll for their own org only.
- **employee / viewer** only get tools scoped to their own employee record (their own PTO
  balance, their own timesheets).
- There is no free-form SQL execution — every tool is a fixed, parameterized query. The
  model cannot expand its own access no matter what it's asked.

---

## 5. Domain & SSL

### Custom Domain on Cloudflare Pages

1. In the Cloudflare Pages dashboard, go to your project → **Custom domains**.
2. Click **Set up a custom domain** and enter your domain (e.g., `crm.yourdomain.com`).
3. Follow Cloudflare's DNS instructions to add a CNAME record.
4. Cloudflare will automatically issue and renew an SSL certificate.

### CORS Configuration

Ensure the backend allows requests from your frontend domain. The backend should already be reading `APP_URL` from environment variables for CORS configuration.

- Set `APP_URL` to the exact frontend URL:
  ```env
  APP_URL=https://crm.yourdomain.com
  # or
  APP_URL=https://skarion-crm.pages.dev
  ```

- Verify the backend's CORS middleware is configured to allow this origin.

---

## 6. Monitoring & Health

### Health Check Endpoint

The backend exposes a health check at:

```
GET /health
```

Expected response:
```json
{ "status": "ok" }
```

### Uptime Monitoring

Set up external monitoring to alert you if the service goes down:

- **UptimeRobot:** [https://uptimerobot.com](https://uptimerobot.com) — Free tier monitors every 5 minutes.
- **Pingdom:** [https://www.pingdom.com](https://www.pingdom.com) — Paid, but more advanced.
- **Better Uptime:** [https://betteruptime.com](https://betteruptime.com) — Free for basic checks.

Configure the monitor to ping `https://your-backend-url.railway.app/health`.

### Logging

The backend already uses **Winston** for structured logging. Logs are written to:
- Console (standard output)
- Optionally, files in `server/logs/`

For production, consider forwarding logs to a centralized service:
- **Railway:** Logs are available in the dashboard automatically.
- **Render:** Logs are streamed in the dashboard.
- **Datadog / Logtail / Papertrail:** Forward stdout logs for advanced analysis.

---

## 7. Backup & Security

### Database Backups

- **Neon:** Automatic daily backups are included. You can also create manual snapshots (branches) instantly.
- **Neon PITR:** Use `infra/runbooks/neon-pitr-restore.md` for true point-in-time recovery.
- **R2 logical backups:** `.github/workflows/neon-backup.yml` can run manually or weekly to upload compressed `pg_dump` backups and checksums to Cloudflare R2. See `infra/runbooks/r2-logical-backups.md`.
- **Self-Hosted Postgres:** Use `pg_dump` or configure automated backups with a tool like `pgbackrest`.

### Security Checklist

- [ ] **Strong JWT Secret:** Use `openssl rand -base64 32` to generate a secure 32+ character secret.
- [ ] **SSL:** Ensure all connections use HTTPS/SSL. Neon enforces SSL. Cloudflare Pages enforces SSL. Ensure your backend platform has SSL enabled.
- [ ] **Restrict Database Access:** In Neon, restrict database access to your backend's IP address if possible. Avoid exposing the database to the public internet.
- [ ] **Environment Variables:** Never commit `.env` or secrets to Git. Use platform secret management (Railway Variables, Fly Secrets, Render Environment Variables).
- [ ] **Dependency Updates:** Run `npm audit` regularly and update dependencies.
- [ ] **CORS:** Only allow your frontend domain. Do not use `*` in production.

---

## Quick Start Checklist

1. [ ] Create Neon project → get `DATABASE_URL`
2. [ ] Run `npm run db:migrate` and `npm run db:seed`
3. [ ] Choose backend platform (Railway / Render / Fly.io / Docker)
4. [ ] Set all required backend environment variables
5. [ ] Deploy backend and verify `/health`
6. [ ] Build frontend (`cd client && npm run build`)
7. [ ] Deploy `client/dist` to Cloudflare Pages
8. [ ] Set `VITE_API_URL` in Cloudflare Pages environment variables
9. [ ] Configure custom domain (optional)
10. [ ] Set up uptime monitoring
11. [ ] Done! 🎉

---

*For questions or issues, refer to the main [README.md](./README.md) or open an issue in the repository.*
