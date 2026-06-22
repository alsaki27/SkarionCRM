# Accounting (Books) App — Implementation Plan

## Context

The accounting app is currently a stub (`apps/accounting/src/index.ts` exports only a name). The identity system already provisions the `books` app with roles `manager`/`member`. The project is a "One-Stop Financial Recordkeeping, Taxation, Compliance & W2 Solution."

## Architecture

Mirror the CRM app exactly:
- **Backend Worker:** `apps/accounting/src/index.ts` (Hono + Drizzle + Neon)
- **Frontend SPA:** `apps/accounting/web/` (React + Vite + Tailwind + TanStack Query + Zustand)
- **Database schema:** `apps/accounting/src/db/schema.ts` (new `books` namespace)
- **Deployment:** Cloudflare Worker (`skarion-books-platform`) + Pages (`skarion-books`)

## Phase 1 — Foundation (This Sprint)

### 1.1 Database Schema

New tables in `books` namespace:

| Table | Purpose |
|-------|---------|
| `accounts` | Chart of Accounts (assets, liabilities, equity, revenue, expense) |
| `transactions` | General ledger journal entries |
| `transaction_lines` | Double-entry debit/credit lines per transaction |
| `invoices` | Accounts Receivable / billing |
| `invoice_items` | Line items per invoice |
| `tax_codes` | Tax rates by jurisdiction |
| `audit_log` | Same shape as CRM/identity audit_log |

### 1.2 Backend API (Hono Worker)

| Endpoint | Action |
|----------|--------|
| `GET /health` | Health check |
| `GET /api/accounts` | List chart of accounts |
| `POST /api/accounts` | Create account |
| `GET /api/accounts/:id` | Get account detail |
| `PUT /api/accounts/:id` | Update account |
| `DELETE /api/accounts/:id` | Soft delete account |
| `GET /api/transactions` | List journal entries |
| `POST /api/transactions` | Create journal entry (must balance) |
| `GET /api/transactions/:id` | Get journal entry detail |
| `PUT /api/transactions/:id` | Update journal entry |
| `DELETE /api/transactions/:id` | Soft delete |
| `GET /api/invoices` | List invoices |
| `POST /api/invoices` | Create invoice |
| `GET /api/invoices/:id` | Get invoice detail |
| `PUT /api/invoices/:id` | Update invoice |
| `POST /api/invoices/:id/mark-paid` | Record payment |
| `GET /api/tax-codes` | List tax codes |
| `POST /api/tax-codes` | Create tax code |
| `GET /api/reports/balance-sheet` | Balance sheet as-of-date |
| `GET /api/reports/income-statement` | P&L for period |

Auth: `requireAuth` from `@skarion/auth-client`, role `books` from JWT `apps.books`.
Permissions: `can()` from `@skarion/permissions` (manager = full, member = view only).
Audit: `withAudit()` from `@skarion/db-kit` on every mutation.

### 1.3 Frontend SPA

| Route | Page |
|-------|------|
| `/` | Dashboard: totals, recent activity, outstanding invoices |
| `/accounts` | Chart of Accounts table |
| `/accounts/:id` | Account detail + transactions |
| `/transactions` | General ledger list |
| `/transactions/:id` | Journal entry detail |
| `/invoices` | Invoice list |
| `/invoices/:id` | Invoice detail |
| `/reports` | Reporting hub (balance sheet, income statement) |
| `/settings` | Fiscal year config |

Same stack as CRM web: React 19 + React Router + TanStack Query + Zustand + Tailwind + Vite + Lucide icons.

### 1.4 Monorepo Integration

- Add `apps/accounting/web` to `pnpm-workspace.yaml`
- Add `deploy-books.yml` GitHub Actions workflow (mirror `deploy-crm.yml`)
- `wrangler.toml` for Worker with `name = "skarion-books-platform"`
- `wrangler.toml` for Pages (or Pages deploy via GitHub integration)
- Update CI to include accounting packages

## Phase 2 — Advanced Features (Next Sprint)

- W2 / payroll records
- Tax filing workflows
- Compliance checklists
- Bank reconciliation
- Multi-currency support
- CSV import for transactions
- Budget vs. actual reporting
- Audit trail dashboard

## Phase 3 — Integration

- CRM → Accounting: convert opportunities to invoices
- CRM → Accounting: company billing info sync
- Identity → Accounting: role-based access (already works)
- Email: invoice reminders, payment receipts

## Validation Checklist

- [ ] `pnpm typecheck` passes across entire monorepo
- [ ] `pnpm lint` passes across entire monorepo
- [ ] `pnpm build` passes for both Worker and Pages
- [ ] Backend health endpoint returns 200
- [ ] Frontend builds and serves locally
- [ ] Auth flow works (login → books app → access token → API calls)
- [ ] DB schema migration runs successfully
- [ ] CRUD smoke test for accounts and transactions passes
- [ ] CI passes on GitHub Actions
- [ ] Deploy to Cloudflare Worker + Pages succeeds
