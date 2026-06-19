# Skarion CRM v2.0

**One-Stop Financial Recordkeeping, Taxation, Compliance & W2 Solution**

A complete financial operations platform for small-to-medium businesses and accounting firms. Built with modern TypeScript, React, and PostgreSQL.

---

## Features

| Module | Description |
|--------|-------------|
| **Financial Recordkeeping** | Double-entry bookkeeping, chart of accounts, journal entries, transactions, bank reconciliation |
| **Taxation** | Tax year management, form tracking (W-2, 1099, 940, 941, etc.), tax calculations, deadline monitoring |
| **Compliance** | Regulatory compliance tracking, deadline alerts, evidence management, audit readiness |
| **W2 & Payroll** | Employee management, payroll processing, automatic W-2 generation with box calculations, W-2c corrections |
| **CRM** | Contact management, communication tracking, document linking |
| **Reporting** | P&L, Balance Sheet, Cash Flow, Tax summaries, Compliance reports, Payroll reports |
| **AI Integration** | Document parsing, account suggestions, compliance checks, anomaly detection (placeholder) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS + React Router |
| **Backend** | Node.js + Express + tRPC v11 + Zod |
| **Database** | PostgreSQL 15 + Drizzle ORM + drizzle-zod |
| **Auth** | JWT-based (custom) |
| **AI** | Configurable (Ollama local + OpenAI API) |
| **File Storage** | Supabase Storage |
| **Scheduler** | node-cron |
| **Email** | Resend |

---

## Project Structure

```
skarion-crm/
├── server/                    # Backend API
│   ├── src/
│   │   ├── index.ts          # Express entry point
│   │   ├── trpc.ts           # tRPC setup + auth middleware
│   │   ├── db/
│   │   │   ├── index.ts      # Database connection
│   │   │   ├── schema.ts     # Complete Drizzle schema (20+ tables)
│   │   │   └── seed.ts       # Seed data script
│   │   ├── routers/
│   │   │   ├── _app.ts       # Root router
│   │   │   ├── auth.ts       # Auth (login/register)
│   │   │   ├── org.ts        # Organization & user management
│   │   │   ├── contact.ts    # CRM contacts
│   │   │   ├── financial.ts  # Bookkeeping & GL
│   │   │   ├── tax.ts        # Tax management
│   │   │   ├── compliance.ts # Compliance tracking
│   │   │   ├── employee.ts   # Employee management
│   │   │   ├── payroll.ts    # Payroll processing
│   │   │   ├── w2.ts         # W2 generation & filing
│   │   │   ├── document.ts   # Document management
│   │   │   ├── task.ts       # Task management
│   │   │   ├── report.ts     # Financial reports
│   │   │   └── ai.ts         # AI endpoints
│   │   ├── services/
│   │   │   ├── auth.ts       # JWT auth service
│   │   │   ├── audit.ts      # Audit logging service
│   │   │   └── cron.ts       # Scheduled jobs
│   │   └── utils/            # Utility functions
│   └── package.json
├── client/                    # Frontend SPA
│   ├── src/
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Router + layout
│   │   ├── api.ts             # tRPC client
│   │   ├── store.ts           # Zustand stores
│   │   ├── styles.css         # Tailwind + custom utilities
│   │   ├── components/
│   │   │   ├── layout/        # AppLayout, Sidebar, Header
│   │   │   ├── ui/            # Button, Card, Table, Modal, Badge, etc.
│   │   │   ├── financial/     # AccountTree, TransactionRow, etc.
│   │   │   ├── tax/           # TaxFormStatus, TaxDeadlineBadge
│   │   │   ├── compliance/  # ComplianceMeter, EvidenceUploader
│   │   │   ├── payroll/       # EmployeeCard, PayStubPreview
│   │   │   ├── w2/            # W2BoxEditor, W2Preview
│   │   │   └── dashboard/     # KpiGrid, ActivityFeed, ChartWidgets
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Setup.tsx
│   │   │   ├── Contacts/      # ContactList, ContactDetail, ContactForm
│   │   │   ├── Financial/     # ChartOfAccounts, Transactions, JournalEntries, BankAccounts
│   │   │   ├── Tax/           # TaxYears, TaxForms, TaxDashboard
│   │   │   ├── Compliance/    # ComplianceDashboard, ComplianceItems
│   │   │   ├── Payroll/       # Employees, EmployeeForm, EmployeeDetail, PayrollRuns, PayrollRunForm, PayrollRunDetail
│   │   │   ├── W2/            # W2Dashboard, W2List, W2Generate
│   │   │   ├── Documents/     # DocumentLibrary
│   │   │   ├── Tasks/         # TaskList
│   │   │   ├── Reports/       # ReportPnl, ReportBalanceSheet, ReportCashFlow
│   │   │   └── Settings/      # Organization, Users
│   │   ├── hooks/             # tRPC wrapper hooks
│   │   ├── lib/               # Utilities
│   │   └── types/             # TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
├── package.json               # Root monorepo
├── drizzle.config.ts           # Drizzle ORM config
└── .env.example
```

---

## Database Schema (20+ Tables)

### Core
- `organizations` — Multi-tenant workspace
- `users` — Users with roles (owner, admin, accountant, bookkeeper, viewer, employee)
- `audit_log` — Compliance-grade audit trail

### CRM
- `contacts` — Clients, vendors, employees, contractors
- `contact_communications` — Communication history

### Financial
- `chart_of_accounts` — Chart of accounts with hierarchy
- `bank_accounts` — Bank accounts with reconciliation
- `transactions` — General ledger transactions
- `journal_entries` — Double-entry journal entries with lines
- `budgets` — Budget planning

### Tax
- `tax_years` — Tax year management
- `tax_forms` — Tax form tracking
- `tax_calculations` — Tax calculation records

### Compliance
- `compliance_categories` — Compliance requirement categories
- `compliance_items` — Individual compliance items with deadlines
- `compliance_documents` — Evidence documents

### Payroll & W2
- `employees` — Employee records with tax settings
- `payroll_runs` — Payroll processing runs
- `payroll_entries` — Individual payroll entries with tax calculations
- `w2_forms` — W2 forms with all 20+ boxes

### Documents & Tasks
- `documents` — File storage metadata
- `document_templates` — Template management
- `tasks` — Task management with reminders

### Reporting
- `report_snapshots` — Pre-computed report data

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase recommended)
- npm or pnpm

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# Or install server and client separately
cd server && npm install
cd ../client && npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials and other settings
```

### 3. Database Setup

```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Seed demo data
npm run db:seed
```

### 4. Run Development Servers

```bash
# Run both backend and frontend
npm run dev

# Or separately
npm run dev:server   # Backend on port 4000
npm run dev:client   # Frontend on port 5173
```

### 5. Login

Use the demo credentials:
- **Email**: `admin@democompany.com`
- **Password**: `admin123`

### Current Validation Status

As of the latest audit, `npm run build` completes successfully for both the server and client. The server build emits with `tsc --noCheck` because existing routers still have broad Drizzle/type drift that needs a dedicated cleanup pass.

`npm run lint` is configured for ESLint 9 and currently passes with warnings. `npm run test --workspace=server` starts correctly but requires a configured `DATABASE_URL` test database. `npm run typecheck --workspace=server` and `npm run typecheck --workspace=client` still fail and should be treated as blocking before production hardening.

See `IMPLEMENTATION_AUDIT.md` for detailed findings and remaining work.

---

## API Structure

The backend exposes tRPC routers at `/trpc`:

| Router | Endpoints |
|--------|-----------|
| `auth` | `register`, `login`, `me`, `changePassword` |
| `org` | `getCurrent`, `update`, `listUsers`, `inviteUser`, `updateUserRole`, `deactivateUser` |
| `contact` | `list`, `getById`, `create`, `update`, `delete`, `addCommunication`, `getStats` |
| `financial` | `listAccounts`, `createAccount`, `updateAccount`, `listTransactions`, `createTransaction`, `createJournalEntry`, `postJournalEntry`, `listBankAccounts`, `getAccountBalance`, `getTrialBalance`, `getFinancialStats` |
| `tax` | `listTaxYears`, `createTaxYear`, `closeTaxYear`, `listTaxForms`, `createTaxForm`, `updateTaxForm`, `getTaxSummary`, `calculateTax` |
| `compliance` | `listCategories`, `createCategory`, `listItems`, `createItem`, `updateItem`, `uploadEvidence`, `getComplianceDashboard`, `getComplianceCalendar` |
| `employee` | `list`, `getById`, `create`, `update`, `delete`, `bulkImport`, `getStats` |
| `payroll` | `listRuns`, `createRun`, `addEntry`, `processRun`, `getRunDetails`, `voidRun`, `getPayrollStats` |
| `w2` | `listW2s`, `generateW2`, `updateW2`, `previewW2`, `distributeW2`, `fileW2`, `generateW2c`, `exportW2PDF` |
| `document` | `list`, `create`, `delete`, `getByEntity`, `listTemplates`, `createTemplate` |
| `task` | `list`, `create`, `update`, `delete`, `getDashboard` |
| `report` | `getPnl`, `getBalanceSheet`, `getCashFlow`, `getTaxReport`, `getComplianceReport`, `getPayrollReport`, `getDashboardSummary` |
| `ai` | `parseDocument`, `suggestAccount`, `checkCompliance`, `analyzeTransactions`, `generateW2Preview` |

---

## W2 Calculation Engine

The W2 generation system calculates all boxes from payroll data:

- **Box 1**: Wages, tips, other compensation (gross pay)
- **Box 2**: Federal income tax withheld (from employee settings + payroll entries)
- **Box 3**: Social security wages (capped at wage base)
- **Box 4**: Social security tax withheld (6.2%)
- **Box 5**: Medicare wages and tips (no cap)
- **Box 6**: Medicare tax withheld (1.45% + 0.9% additional over threshold)
- **Box 7**: Social security tips
- **Box 8**: Allocated tips
- **Box 10**: Dependent care benefits
- **Box 11**: Nonqualified plans
- **Box 12**: Deferrals and other compensation (401k, etc.)
- **Box 13**: Statutory employee, retirement plan, third-party sick pay
- **Box 14**: Other deductions (state UI, union dues, etc.)
- **State & Local**: Wages and taxes by jurisdiction

---

## Tax Calculation Engine

Payroll tax calculations include:

- **Federal Income Tax**: Based on W-4 withholding settings
- **Social Security**: 6.2% on wages up to annual wage base ($168,600 for 2024)
- **Medicare**: 1.45% on all wages + 0.9% additional for high earners
- **FUTA**: 6.0% on first $7,000 of wages (before state credit)
- **State & Local**: Configurable per jurisdiction

---

## Security Features

- **Multi-tenancy**: All data scoped by organization
- **Role-based access**: Owner, Admin, Accountant, Bookkeeper, Viewer, Employee
- **Audit trail**: Every create/update/delete logged with before/after values
- **Soft deletes**: Nothing is permanently deleted (compliance-grade)
- **Password hashing**: bcrypt with 12 rounds
- **JWT authentication**: Signed tokens with configurable expiration
- **SSN hashing**: Employee SSNs stored as hashes only

---

## Deployment

### Frontend (Vercel)
```bash
# Connect repo to Vercel, it auto-detects Vite
# Set environment variables in Vercel dashboard
```

### Backend (Railway / VPS)
```bash
# Set DATABASE_URL and other env vars
# Deploy with `npm run build` and `npm start`
```

### Database (Supabase)
```bash
# Run migrations against Supabase PostgreSQL
# Set up connection string with SSL
```

---

## License

MIT

---

Built with  by the Skarion team.
