# Plan: Cloudflare-First Skarion CRM — Reset & Execute

## Current State (cloudflare-platform-rewrite branch)

✅ Already exists and is correct:
- Cloudflare Workers + Hono framework (apps/identity, apps/crm)
- Neon HTTP driver (@neondatabase/serverless)
- Cloudflare Pages frontend (apps/crm/web)
- Separate workers (cron, workflow-runner, email-inbound, embeddings-builder)
- CRM core tables: companies, contacts, leads, opportunities, activities, tasks, auditLog
- Workflow rules, integration configs
- Auth: invite-only, refresh cookies, MFA, password reset, app memberships, admin panel
- Role model: global superadmin + per-app manager/member
- Permissions wired into CRM routers (can, canList)

❌ What needs fixing/switching:
- AI provider: OpenAI → Google Gemini (you have Google credits)
- Main branch still has old Node/Express code
- Frontend auth flow needs end-to-end validation
- Need to ensure all frontend pages exist and work

## Execution Order

### 1. Switch AI Provider to Google Gemini (Priority 1)
- Replace OpenAI embeddings endpoint with Google AI (Gemini embedding API)
- Replace OpenAI chat completion with Gemini API
- Update env vars: GOOGLE_API_KEY, GOOGLE_EMBEDDING_MODEL, GOOGLE_CHAT_MODEL
- Update all workers and CRM worker

### 2. CRM Core Validation (Priority 2)
- Verify all tables have proper CRUD routes
- Verify all frontend pages exist and call correct APIs
- Verify forms submit correctly
- Add any missing pages/routes

### 3. Auth Flow End-to-End (Priority 3)
- Validate login → refresh token → CRM load → nav render
- Validate logout
- Validate role propagation (isSuperadmin, manager, member)
- Validate cross-origin cookies (pages.dev vs workers.dev)

### 4. Main Branch Migration (Priority 4)
- Prepare to make cloudflare-platform-rewrite the new main
- Archive old Node/Express code
- Update CI/CD workflows

### 5. Final Validation (Priority 5)
- typecheck 24/24 clean
- lint 18/18 clean
- Push to cloudflare-platform-rewrite
- Deploy workers

## Key Decisions

- **AI Provider**: Google Gemini (embedding-001 for embeddings, gemini-1.5-flash for chat)
- **Architecture**: All Cloudflare Workers + Neon HTTP + Pages (already correct)
- **No OpenAI**: Remove all OpenAI references, use Google throughout
- **Branch Strategy**: cloudflare-platform-rewrite becomes the new main once validated
