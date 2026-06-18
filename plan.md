# Skarion CRM v3.0 — Massive SaaS Transformation Plan

## Philosophy
Keep the superior decoupled architecture (React + Vite + tRPC + Drizzle + PostgreSQL). Do NOT switch to Next.js monolith. Instead, layer SaaS-grade features on top.

## Stage 1: Database Schema (SaaS Foundation)
### New Tables
1. **plans** — SaaS pricing tiers (free, starter, professional, enterprise)
2. **subscriptions** — Stripe-style subscription records
3. **subscription_items** — line items for metered features
4. **invoices** (billing) — SaaS billing invoices (rename existing to customer_invoices?)
5. **webhooks** — outgoing webhook endpoints
6. **webhook_events** — delivery log
7. **api_keys** — per-org API keys for integrations
8. **feature_flags** — per-org feature toggles
9. **org_invites** — email invites for team members
10. **notifications** — in-app notification system
11. **activity_logs** — org-wide activity feed
12. **search_index** — full-text search materialized

## Stage 2: Backend SaaS Services
1. **Webhook Engine** — async delivery with retries, exponential backoff
2. **Rate Limiter** — per-org + per-API-key rate limits
3. **API Key Auth** — middleware for API key authentication (separate from JWT)
4. **Caching Layer** — Redis-compatible in-memory cache for hot data
5. **File Upload Service** — Supabase Storage integration
6. **Email Service** — Resend for transactional emails
7. **Billing Service** — plan enforcement, usage metering
8. **Audit Service** — already exists, enhance

## Stage 3: Frontend SaaS Experience
1. **Landing Page** — marketing site (hero, features, pricing, testimonials)
2. **Onboarding Wizard** — step-by-step org setup
3. **Dark Mode** — system-wide toggle
4. **Premium UI** — Framer Motion animations, better transitions, glassmorphism
5. **Responsive Design** — mobile-first
6. **Command Palette** — Cmd+K global search
7. **Notification Center** — bell icon with dropdown
8. **Activity Feed** — sidebar or dedicated page

## Stage 4: TalentOS Feature Extraction
1. **ATS Importers** — Greenhouse API, Lever API, CSV bulk import
2. **CSV Normalizer** — intelligent column mapping, deduplication
3. **AI Daily Digest** — GPT-powered summary of org activity
4. **Candidate Pipeline** — Kanban board for leads/candidates
5. **Follow-up Reminders** — smart reminder system

## Stage 5: Real-Time & Integrations
1. **WebSocket Server** — Socket.io for real-time updates
2. **Search Engine** — full-text search with tsvector
3. **Bulk Operations** — CSV export/import, batch actions
4. ** Zapier-style Webhooks** — user-configurable outbound webhooks
5. **API Documentation** — OpenAPI / Swagger

## Execution Order
1. Schema (all new tables in one migration)
2. Backend services (parallel workers)
3. Frontend landing page + onboarding (parallel workers)
4. Redesign existing pages (parallel workers)
5. New TalentOS features (parallel workers)
6. Integration & polish
7. Deploy
