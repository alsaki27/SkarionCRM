# Skarion CRM v2.0 — Implementation Plan

## One-Stop Financial Recordkeeping, Taxation, Compliance & W2 Solution

---

## 1. Vision & Scope

Transform the existing Skarion CRM from a career-bootcamp lead-management system into a **complete financial operations platform** for small-to-medium businesses and accounting firms. The system handles the full lifecycle of financial, tax, compliance, and payroll operations.

### Core Modules

| Module | Purpose | Key Features |
|--------|---------|-------------|
| **Organization & Auth** | Multi-tenant workspace management | Users, roles, organizations, subscriptions |
| **CRM / Contacts** | Client, vendor, employee records | Contact management, tags, communication history |
| **Financial Recordkeeping** | Bookkeeping & general ledger | Chart of accounts, journal entries, transactions, bank accounts, reconciliations |
| **Taxation** | Tax preparation & filing | Tax year management, form templates, tax calculations, filing tracking, 1099 support |
| **Compliance** | Regulatory compliance tracking | Requirements, deadlines, documents, status tracking, audit readiness |
| **W2 & Payroll** | Employee wage & W2 management | Employees, payroll runs, wage entries, tax withholdings, W2 generation & export |
| **Document Management** | Secure file storage & templates | Uploads, e-signatures, document templates, version control |
| **Reporting & Analytics** | Financial intelligence | P&L, balance sheet, cash flow, tax summaries, compliance dashboards |
| **Tasks & Reminders** | Workflow & deadline management | Tasks, reminders, SLA tracking, audit logs |
| **AI Integration** | Intelligent automation | Document parsing, compliance checks, anomaly detection, tax form suggestions |

### Tech Stack (Retained from v1)

| Layer | Technology | Hosting Target |
|-------|-----------|----------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + React Router | Vercel |
| Backend | Node.js + Express + tRPC v11 + Zod | Railway / VPS |
| Database | PostgreSQL 15 + Drizzle ORM + drizzle-zod | Supabase |
| Auth | JWT-based (custom, not Clerk — simpler for SMB use) | In-house |
| AI | Ollama local + OpenAI API (configurable) | Local / External |
| File Storage | Supabase Storage | Supabase (1GB free) |
| Scheduler | node-cron | In-process |
| Email | Resend (free: 100 emails/day) | Resend |

---

## 2. Database Schema Design

### Schema Philosophy

- **Multi-tenant by organization**: Every table (except `users` and `organizations`) has an `org_id` column for workspace isolation
- **Soft deletes**: `deleted_at` timestamp on all business tables (not `activity_log` or `audit` tables)
- **UUID primary keys**: Continued from v1 for safe merging and no enumeration
- **JSONB flexibility**: For configurable tax rules, compliance metadata, document metadata
- **Audit trails**: Separate `audit_log` table for compliance-grade tracking

### 2.1 Core Tables

#### organizations
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
name VARCHAR(255) NOT NULL,
slug VARCHAR(255) UNIQUE NOT NULL,
tax_id VARCHAR(50),           -- EIN / Tax ID
business_type VARCHAR(50),     -- llc, corporation, sole_proprietorship, partnership, nonprofit
industry VARCHAR(100),
address JSONB DEFAULT '{}',
phone VARCHAR(50),
email VARCHAR(255),
website VARCHAR(255),
fiscal_year_end VARCHAR(5),    -- MM-DD
timezone VARCHAR(50) DEFAULT 'America/New_York',
currency VARCHAR(3) DEFAULT 'USD',
plan VARCHAR(50) DEFAULT 'free',  -- free, starter, professional, enterprise
status VARCHAR(20) DEFAULT 'active',  -- active, suspended, cancelled
settings JSONB DEFAULT '{}',  -- configurable org settings
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### users
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
email VARCHAR(255) NOT NULL,
full_name VARCHAR(255) NOT NULL,
role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'bookkeeper', 'viewer', 'employee')),
phone VARCHAR(50),
avatar_url TEXT,
is_active BOOLEAN DEFAULT true,
last_login_at TIMESTAMPTZ,
settings JSONB DEFAULT '{}',
UNIQUE(org_id, email),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### audit_log (compliance-grade)
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
user_id UUID,
action VARCHAR(100) NOT NULL,  -- create, update, delete, login, export, view
entity_type VARCHAR(50) NOT NULL,  -- contact, transaction, employee, w2, compliance_item, etc.
entity_id UUID,
old_values JSONB,
new_values JSONB,
ip_address INET,
user_agent TEXT,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.2 CRM / Contacts Module

#### contacts
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
full_name VARCHAR(255) NOT NULL,
email VARCHAR(255),
phone VARCHAR(50),
type VARCHAR(50) NOT NULL CHECK (type IN ('client', 'vendor', 'employee', 'contractor', 'prospect', 'partner')),
status VARCHAR(20) DEFAULT 'active',  -- active, inactive, archived
company_name VARCHAR(255),
tax_id VARCHAR(50),  -- SSN, EIN, or ITIN for contractors
address JSONB DEFAULT '{}',
tags TEXT[] DEFAULT '{}',
notes TEXT,
last_contacted_at TIMESTAMPTZ,
assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
deleted_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### contact_communications
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
channel VARCHAR(50) NOT NULL,  -- email, phone, sms, meeting, note
direction VARCHAR(10) NOT NULL,  -- inbound, outbound
content TEXT NOT NULL,
metadata JSONB DEFAULT '{}',  -- email_subject, meeting_duration, etc.
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.3 Financial Recordkeeping Module

#### chart_of_accounts
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
code VARCHAR(50) NOT NULL,  -- e.g., 1000, 2100, 5000
name VARCHAR(255) NOT NULL,
account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
account_subtype VARCHAR(100),  -- e.g., current_asset, long_term_liability, operating_expense
parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
level INTEGER DEFAULT 1,
is_bank_account BOOLEAN DEFAULT false,
bank_account_id UUID,  -- links to bank_accounts if applicable
is_active BOOLEAN DEFAULT true,
description TEXT,
org_id + code UNIQUE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### bank_accounts
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
account_name VARCHAR(255) NOT NULL,
bank_name VARCHAR(255),
account_number_hash VARCHAR(255),  -- hashed for security
account_type VARCHAR(50),  -- checking, savings, credit_card, loan
routing_number VARCHAR(20),
currency VARCHAR(3) DEFAULT 'USD',
opening_balance DECIMAL(15,2) DEFAULT 0,
current_balance DECIMAL(15,2) DEFAULT 0,
last_reconciled_at TIMESTAMPTZ,
last_reconciled_balance DECIMAL(15,2) DEFAULT 0,
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### transactions
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,  -- if bank-linked
contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
transaction_type VARCHAR(50) NOT NULL,  -- deposit, withdrawal, transfer, adjustment, journal_entry
description TEXT NOT NULL,
amount DECIMAL(15,2) NOT NULL,
 debit_credit VARCHAR(10) NOT NULL CHECK (debit_credit IN ('debit', 'credit')),
reference_number VARCHAR(255),  -- check number, wire ref, etc.
transaction_date DATE NOT NULL,
memo TEXT,
attachments JSONB DEFAULT '[]',  -- array of file references
is_reconciled BOOLEAN DEFAULT false,
reconciled_at TIMESTAMPTZ,
reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
metadata JSONB DEFAULT '{}',
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### journal_entries
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
entry_number VARCHAR(50) NOT NULL,
entry_date DATE NOT NULL,
reference VARCHAR(255),
description TEXT,
status VARCHAR(20) DEFAULT 'draft',  -- draft, posted, reversed
is_reversing_entry BOOLEAN DEFAULT false,
reversed_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
total_debit DECIMAL(15,2) NOT NULL,
total_credit DECIMAL(15,2) NOT NULL,
posted_at TIMESTAMPTZ,
posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
UNIQUE(org_id, entry_number),
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### journal_entry_lines
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
line_number INTEGER NOT NULL,
description TEXT,
amount DECIMAL(15,2) NOT NULL,
 debit_credit VARCHAR(10) NOT NULL CHECK (debit_credit IN ('debit', 'credit')),
contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
metadata JSONB DEFAULT '{}'
```

#### budgets
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
name VARCHAR(255) NOT NULL,
fiscal_year INTEGER NOT NULL,
period_type VARCHAR(20) DEFAULT 'annual',  -- annual, quarterly, monthly
status VARCHAR(20) DEFAULT 'draft',  -- draft, active, closed
account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
amount DECIMAL(15,2) NOT NULL,
period_start DATE NOT NULL,
period_end DATE NOT NULL,
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.4 Taxation Module

#### tax_years
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
year INTEGER NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
status VARCHAR(20) DEFAULT 'open',  -- open, closed, filing, extended
form_types TEXT[] DEFAULT '{}',  -- w2, 1099, 1040, 1120, 1065, 990, etc.
extension_filed BOOLEAN DEFAULT false,
extension_deadline DATE,
filed_date DATE,
notes TEXT,
UNIQUE(org_id, year),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### tax_forms
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
tax_year_id UUID NOT NULL REFERENCES tax_years(id) ON DELETE CASCADE,
form_type VARCHAR(50) NOT NULL,  -- w2, 1099_nec, 1099_misc, 940, 941, 944, 1040, 1120, 1065, 990, etc.
form_name VARCHAR(255) NOT NULL,
status VARCHAR(20) DEFAULT 'draft',  -- draft, ready, filed, amended, rejected
filing_deadline DATE NOT NULL,
filed_date DATE,
irs_acknowledgment VARCHAR(255),
efile_transmission_id VARCHAR(255),
amount DECIMAL(15,2),  -- total tax amount if applicable
contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,  -- for individual forms (W2, 1099)
prepared_by UUID REFERENCES users(id) ON DELETE SET NULL,
reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
metadata JSONB DEFAULT '{}',  -- form-specific data
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### tax_calculations
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
tax_year_id UUID NOT NULL,
form_type VARCHAR(50) NOT NULL,
calculation_type VARCHAR(50) NOT NULL,  -- federal_income, state_income, fica, futa, sutare, etc.
base_amount DECIMAL(15,2) NOT NULL,
rate DECIMAL(10,6) DEFAULT 0,
calculated_amount DECIMAL(15,2) NOT NULL,
jurisdiction VARCHAR(100),  -- US, CA, NY, etc.
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.5 Compliance Module

#### compliance_categories
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
name VARCHAR(255) NOT NULL,
description TEXT,
regulatory_body VARCHAR(255),  -- IRS, OSHA, DOL, EPA, SEC, etc.
frequency VARCHAR(50),  -- annual, quarterly, monthly, weekly, event_based
priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, critical
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### compliance_items
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
category_id UUID REFERENCES compliance_categories(id) ON DELETE SET NULL,
title VARCHAR(255) NOT NULL,
description TEXT,
status VARCHAR(20) DEFAULT 'not_started',  -- not_started, in_progress, compliant, non_compliant, at_risk, overdue
due_date DATE,
completed_date DATE,
assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
reviewer UUID REFERENCES users(id) ON DELETE SET NULL,
evidence_required BOOLEAN DEFAULT false,
evidence_files JSONB DEFAULT '[]',
next_review_date DATE,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### compliance_documents
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
compliance_item_id UUID REFERENCES compliance_items(id) ON DELETE CASCADE,
document_name VARCHAR(255) NOT NULL,
file_path TEXT NOT NULL,  -- Supabase Storage path
file_type VARCHAR(50),
file_size INTEGER,
uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.6 W2 & Payroll Module

#### employees
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,  -- links to contacts if applicable
employee_id VARCHAR(50) NOT NULL,  -- internal employee number
ssn_hash VARCHAR(255),  -- hashed SSN
first_name VARCHAR(100) NOT NULL,
last_name VARCHAR(100) NOT NULL,
email VARCHAR(255),
phone VARCHAR(50),
hire_date DATE NOT NULL,
termination_date DATE,
status VARCHAR(20) DEFAULT 'active',  -- active, terminated, on_leave, suspended
employment_type VARCHAR(20) DEFAULT 'full_time',  -- full_time, part_time, contractor, intern
job_title VARCHAR(255),
department VARCHAR(100),
pay_rate DECIMAL(10,2),
pay_frequency VARCHAR(20),  -- hourly, weekly, biweekly, semimonthly, monthly, annually
pay_type VARCHAR(20),  -- salary, hourly, commission, piece_rate
address JSONB DEFAULT '{}',
bank_account JSONB DEFAULT '{}',  -- direct deposit info
withholding_federal DECIMAL(10,2) DEFAULT 0,
withholding_state VARCHAR(10),
withholding_state_amount DECIMAL(10,2) DEFAULT 0,
withholding_local DECIMAL(10,2) DEFAULT 0,
retirement_401k_rate DECIMAL(5,2) DEFAULT 0,
health_insurance_premium DECIMAL(10,2) DEFAULT 0,
other_deductions JSONB DEFAULT '[]',
metadata JSONB DEFAULT '{}',
UNIQUE(org_id, employee_id),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### payroll_runs
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
run_name VARCHAR(255) NOT NULL,
period_start DATE NOT NULL,
period_end DATE NOT NULL,
pay_date DATE NOT NULL,
status VARCHAR(20) DEFAULT 'draft',  -- draft, processing, completed, cancelled
total_gross DECIMAL(15,2) DEFAULT 0,
total_fica DECIMAL(15,2) DEFAULT 0,
total_federal_tax DECIMAL(15,2) DEFAULT 0,
total_state_tax DECIMAL(15,2) DEFAULT 0,
total_deductions DECIMAL(15,2) DEFAULT 0,
total_net DECIMAL(15,2) DEFAULT 0,
processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
processed_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### payroll_entries
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
regular_hours DECIMAL(8,2) DEFAULT 0,
overtime_hours DECIMAL(8,2) DEFAULT 0,
gross_pay DECIMAL(15,2) NOT NULL,
federal_tax DECIMAL(15,2) DEFAULT 0,
social_security_tax DECIMAL(15,2) DEFAULT 0,
medicare_tax DECIMAL(15,2) DEFAULT 0,
state_tax DECIMAL(15,2) DEFAULT 0,
local_tax DECIMAL(15,2) DEFAULT 0,
retirement_401k DECIMAL(15,2) DEFAULT 0,
health_insurance DECIMAL(15,2) DEFAULT 0,
other_deductions DECIMAL(15,2) DEFAULT 0,
net_pay DECIMAL(15,2) NOT NULL,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### w2_forms
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
tax_year_id UUID NOT NULL REFERENCES tax_years(id) ON DELETE CASCADE,
form_status VARCHAR(20) DEFAULT 'draft',  -- draft, generated, distributed, filed, corrected
box_1_wages DECIMAL(15,2) DEFAULT 0,    -- Wages, tips, other compensation
box_2_federal_tax DECIMAL(15,2) DEFAULT 0,  -- Federal income tax withheld
box_3_social_wages DECIMAL(15,2) DEFAULT 0,  -- Social security wages
box_4_social_tax DECIMAL(15,2) DEFAULT 0,    -- Social security tax withheld
box_5_medicare_wages DECIMAL(15,2) DEFAULT 0,  -- Medicare wages and tips
box_6_medicare_tax DECIMAL(15,2) DEFAULT 0,    -- Medicare tax withheld
box_7_social_tips DECIMAL(15,2) DEFAULT 0,     -- Social security tips
box_8_allocated_tips DECIMAL(15,2) DEFAULT 0,  -- Allocated tips
box_10_dependent_care DECIMAL(15,2) DEFAULT 0,  -- Dependent care benefits
box_11_nonqualified_plans DECIMAL(15,2) DEFAULT 0,  -- Nonqualified plans
box_12_codes JSONB DEFAULT '[]',  -- Deferrals and other compensation
box_13_checkboxes JSONB DEFAULT '{}',  -- Statutory employee, retirement plan, third-party sick pay
box_14_other JSONB DEFAULT '[]',  -- Other deductions
state_wages JSONB DEFAULT '[]',   -- State wages, tips, etc. by state
local_wages JSONB DEFAULT '[]',   -- Local wages, etc. by locality
employee_copy_distributed_at TIMESTAMPTZ,
irs_filed_at TIMESTAMPTZ,
ssa_filed_at TIMESTAMPTZ,
generated_pdf_path TEXT,
corrected_w2_id UUID REFERENCES w2_forms(id) ON DELETE SET NULL,  -- for W-2c
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.7 Document Management Module

#### documents
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
entity_type VARCHAR(50),  -- contact, transaction, employee, compliance_item, tax_form, etc.
entity_id UUID,
file_name VARCHAR(255) NOT NULL,
file_path TEXT NOT NULL,  -- Supabase Storage path
file_type VARCHAR(50),
file_size INTEGER,
storage_provider VARCHAR(20) DEFAULT 'supabase',
uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
metadata JSONB DEFAULT '{}',  -- tags, description, OCR text, etc.
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### document_templates
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
name VARCHAR(255) NOT NULL,
template_type VARCHAR(50) NOT NULL,  -- w2, 1099, contract, invoice, letter, compliance
file_path TEXT,  -- template file in storage
variables JSONB DEFAULT '[]',  -- template variables
description TEXT,
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.8 Tasks & Reminders Module

#### tasks
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
entity_type VARCHAR(50),  -- contact, transaction, employee, compliance_item, tax_form, etc.
entity_id UUID,
type VARCHAR(50) NOT NULL,  -- follow_up, review, filing_deadline, compliance_review, tax_preparation, payment, reconciliation, general
title VARCHAR(500) NOT NULL,
description TEXT,
due_at TIMESTAMPTZ,
status VARCHAR(20) DEFAULT 'todo',  -- todo, in_progress, done, cancelled, overdue
priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
completed_at TIMESTAMPTZ,
completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
reminder_sent_at TIMESTAMPTZ,
reminder_count INTEGER DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.9 Reporting Snapshots (for fast dashboards)

#### report_snapshots
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
org_id UUID NOT NULL,
report_type VARCHAR(50) NOT NULL,  -- pnl, balance_sheet, cash_flow, tax_summary, compliance_status, payroll_summary
period_start DATE NOT NULL,
period_end DATE NOT NULL,
data JSONB NOT NULL,
generated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## 3. API Design (tRPC + Zod)

### Router Structure

```typescript
// server/routers/_app.ts
import { router } from '../trpc';
import { orgRouter } from './org';
import { contactRouter } from './contact';
import { financialRouter } from './financial';
import { taxRouter } from './tax';
import { complianceRouter } from './compliance';
import { employeeRouter } from './employee';
import { payrollRouter } from './payroll';
import { w2Router } from './w2';
import { documentRouter } from './document';
import { taskRouter } from './task';
import { reportRouter } from './report';
import { aiRouter } from './ai';

export const appRouter = router({
  org: orgRouter,
  contact: contactRouter,
  financial: financialRouter,
  tax: taxRouter,
  compliance: complianceRouter,
  employee: employeeRouter,
  payroll: payrollRouter,
  w2: w2Router,
  document: documentRouter,
  task: taskRouter,
  report: reportRouter,
  ai: aiRouter,
});
```

### Key Routers & Procedures

| Router | Key Procedures | Description |
|--------|----------------|-------------|
| `org` | `getCurrent`, `update`, `inviteUser`, `listUsers`, `updateUserRole` | Organization & user management |
| `contact` | `list`, `create`, `update`, `delete`, `getById`, `getStats`, `bulkImport` | CRM contact management |
| `financial` | `listAccounts`, `createAccount`, `listTransactions`, `createTransaction`, `createJournalEntry`, `postJournalEntry`, `listJournalEntries`, `reconcileTransaction`, `getAccountBalance`, `getTrialBalance` | Bookkeeping & GL |
| `tax` | `listTaxYears`, `createTaxYear`, `closeTaxYear`, `listTaxForms`, `createTaxForm`, `updateTaxForm`, `calculateTax`, `getTaxSummary` | Tax preparation |
| `compliance` | `listCategories`, `createCategory`, `listItems`, `createItem`, `updateItemStatus`, `uploadEvidence`, `getComplianceDashboard` | Compliance tracking |
| `employee` | `list`, `create`, `update`, `getById`, `bulkImport`, `terminate` | Employee management |
| `payroll` | `listRuns`, `createRun`, `addEntry`, `processRun`, `getRunDetails`, `voidRun` | Payroll processing |
| `w2` | `generateW2`, `previewW2`, `distributeW2`, `fileW2`, `generateW2c`, `listW2s`, `exportW2PDF` | W2 generation & filing |
| `document` | `upload`, `list`, `delete`, `getByEntity`, `createTemplate` | Document management |
| `task` | `list`, `create`, `update`, `complete`, `getOverdue`, `getDashboard` | Task management |
| `report` | `getPnl`, `getBalanceSheet`, `getCashFlow`, `getTaxReport`, `getComplianceReport`, `getPayrollReport` | Financial reports |
| `ai` | `parseDocument`, `suggestAccount`, `checkCompliance`, `analyzeTransactions`, `generateW2Preview` | AI automation |

---

## 4. Service Layer

### 4.1 Core Services

| Service | Responsibility |
|---------|---------------|
| `AuditService` | Write audit_log entries for every mutation |
| `AuthService` | JWT generation/validation, password hashing |
| `OrgService` | Organization CRUD, user invitation |
| `ContactService` | Contact CRUD, deduplication, communication tracking |
| `FinancialService` | Transaction processing, journal entry posting, reconciliation, balance calculations |
| `TaxService` | Tax calculation engine, form validation, year-end closing |
| `ComplianceService` | Deadline tracking, status evaluation, evidence management |
| `EmployeeService` | Employee CRUD, bulk import, termination handling |
| `PayrollService` | Payroll run processing, tax calculation, net pay computation |
| `W2Service` | W2 box calculations, PDF generation, e-file formatting, W-2c corrections |
| `DocumentService` | File upload/download, OCR, template processing |
| `TaskService` | Task lifecycle, reminders, SLA monitoring |
| `ReportService` | Report generation, snapshot caching, chart data |
| `AIService` | Document parsing, anomaly detection, suggestions, compliance checks |
| `CronService` | Scheduled jobs (reminders, reconciliations, snapshots, filing deadline checks) |

### 4.2 W2 Calculation Engine (Critical Service)

```typescript
class W2Service {
  // Calculate all W2 boxes from payroll data
  async calculateW2(employeeId: string, taxYearId: string): Promise<W2Calculation> {
    const payrollEntries = await this.getPayrollEntriesForYear(employeeId, taxYearId);
    
    return {
      box1: this.sumGrossPay(payrollEntries),          // Wages, tips, other compensation
      box2: this.sumFederalTax(payrollEntries),        // Federal income tax withheld
      box3: this.sumSocialSecurityWages(payrollEntries), // Social security wages (capped at wage base)
      box4: this.sumSocialSecurityTax(payrollEntries),   // Social security tax (capped)
      box5: this.sumMedicareWages(payrollEntries),       // Medicare wages (no cap)
      box6: this.sumMedicareTax(payrollEntries),         // Medicare tax (1.45% + 0.9% over threshold)
      box7: this.sumSocialSecurityTips(payrollEntries), // Social security tips
      box10: this.sumDependentCare(payrollEntries),       // Dependent care benefits
      box11: this.sumNonqualifiedPlans(payrollEntries),  // Nonqualified plans
      box12: this.calculateDeferredCompensation(payrollEntries), // 401k, etc.
      box13: this.determineCheckboxes(employeeId),      // Statutory, retirement, third-party
      box14: this.calculateOtherDeductions(payrollEntries), // State UI, union dues, etc.
      stateWages: this.calculateStateWages(payrollEntries),  // Per state
      localWages: this.calculateLocalWages(payrollEntries),    // Per locality
    };
  }

  // Generate PDF using a template engine
  async generateW2PDF(w2Id: string): Promise<Buffer> {
    // Uses PDF generation (pdf-lib or similar) to create W2 form
  }

  // Export for e-filing (XML format for SSA/IRS)
  async exportEfile(w2Forms: W2Form[]): Promise<string> {
    // Generates XML in the format required by SSA's EFW2 spec
  }
}
```

### 4.3 Tax Calculation Engine

```typescript
class TaxService {
  // Federal income tax calculation (using simplified brackets or tax tables)
  async calculateFederalIncomeTax(payrollEntry: PayrollEntry): Promise<number> {
    // Look up tax table based on income, pay frequency, and W-4 info
  }

  // FICA calculation
  calculateFICA(grossPay: number, ytdSocialSecurityWages: number): {
    socialSecurity: number;
    medicare: number;
    additionalMedicare: number;
  } {
    const ssWageBase = 168600; // 2024 wage base
    const ssRate = 0.062;
    const medicareRate = 0.0145;
    const additionalMedicareRate = 0.009;
    const additionalMedicareThreshold = 200000; // Single filer

    const socialSecurityWages = Math.min(grossPay, Math.max(0, ssWageBase - ytdSocialSecurityWages));
    const socialSecurity = socialSecurityWages * ssRate;
    const medicare = grossPay * medicareRate;
    const additionalMedicare = (ytdSocialSecurityWages + grossPay > additionalMedicareThreshold) 
      ? Math.max(0, (ytdSocialSecurityWages + grossPay - additionalMedicareThreshold)) * additionalMedicareRate
      : 0;

    return { socialSecurity, medicare, additionalMedicare };
  }

  // FUTA calculation
  calculateFUTA(grossPay: number, ytdFUTAWages: number): number {
    const futaWageBase = 7000;
    const futaRate = 0.006; // Standard rate (0.054 before state credit)
    const futaWages = Math.min(grossPay, Math.max(0, futaWageBase - ytdFUTAWages));
    return futaWages * futaRate;
  }
}
```

### 4.4 AI Service

```typescript
class AIService {
  // Parse uploaded documents (invoices, receipts, W2s, 1099s)
  async parseDocument(fileContent: Buffer, fileType: string): Promise<ParsedDocument> {
    // Use vision model or text extraction to identify document type and extract key fields
  }

  // Suggest chart of accounts for a transaction
  async suggestAccount(description: string, amount: number): Promise<string[]> {
    // Classify transaction into account categories
  }

  // Check compliance status
  async checkCompliance(items: ComplianceItem[]): Promise<ComplianceRisk[]> {
    // Identify at-risk items, suggest remediation
  }

  // Detect anomalies in transactions
  async analyzeTransactions(transactions: Transaction[]): Promise<Anomaly[]> {
    // Flag unusual amounts, duplicate transactions, unexpected patterns
  }
}
```

---

## 5. Frontend Architecture

### 5.1 Page Structure

```
src/
├── pages/
│   ├── Dashboard.tsx              # Main dashboard with KPIs, charts, tasks
│   ├── Contacts/
│   │   ├── ContactList.tsx        # Contact list with filters, search, tags
│   │   ├── ContactDetail.tsx      # Full contact profile + history
│   │   └── ContactForm.tsx        # Add/edit contact form
│   ├── Financial/
│   │   ├── ChartOfAccounts.tsx    # COA tree/grid view
│   │   ├── Transactions.tsx       # Transaction list with filters
│   │   ├── TransactionForm.tsx    # Add/edit transaction
│   │   ├── JournalEntries.tsx     # Journal entry list + posting
│   │   ├── JournalEntryForm.tsx   # Multi-line JE form
│   │   ├── BankAccounts.tsx       # Bank account management + reconciliation
│   │   ├── Reconciliation.tsx     # Reconciliation view
│   │   └── Budgets.tsx            # Budget setup & variance
│   ├── Tax/
│   │   ├── TaxYears.tsx           # Tax year management
│   │   ├── TaxForms.tsx           # Tax form list & status
│   │   ├── TaxFormEditor.tsx      # Form-specific data entry
│   │   ├── TaxCalculator.tsx      # Interactive tax calculator
│   │   └── TaxDashboard.tsx       # Tax summary & deadlines
│   ├── Compliance/
│   │   ├── ComplianceDashboard.tsx # Compliance overview, risk scores
│   │   ├── ComplianceItems.tsx     # Item list with filters
│   │   ├── ComplianceForm.tsx      # Add/edit compliance item
│   │   └── ComplianceCalendar.tsx  # Calendar view of deadlines
│   ├── Payroll/
│   │   ├── Employees.tsx           # Employee list + management
│   │   ├── EmployeeForm.tsx        # Add/edit employee
│   │   ├── EmployeeDetail.tsx      # Employee profile + history
│   │   ├── PayrollRuns.tsx         # Payroll run list
│   │   ├── PayrollRunForm.tsx      # Create payroll run + entries
│   │   └── PayrollRunDetail.tsx    # Review, process, void
│   ├── W2/
│   │   ├── W2Dashboard.tsx         # W2 overview per tax year
│   │   ├── W2List.tsx              # List of all W2s
│   │   ├── W2Preview.tsx           # W2 preview (PDF viewer)
│   │   ├── W2Generate.tsx          # Generate W2s from payroll
│   │   └── W2Correct.tsx           # W-2c correction workflow
│   ├── Documents/
│   │   ├── DocumentLibrary.tsx     # All documents, filters, search
│   │   ├── DocumentUpload.tsx      # Upload with metadata
│   │   └── DocumentViewer.tsx      # PDF/image viewer
│   ├── Tasks/
│   │   ├── TaskList.tsx            # All tasks, filters, kanban
│   │   ├── TaskForm.tsx            # Add/edit task
│   │   └── TaskCalendar.tsx        # Calendar view of tasks
│   ├── Reports/
│   │   ├── ReportPnl.tsx           # Profit & Loss statement
│   │   ├── ReportBalanceSheet.tsx  # Balance sheet
│   │   ├── ReportCashFlow.tsx      # Cash flow statement
│   │   ├── ReportTax.tsx           # Tax reports
│   │   ├── ReportCompliance.tsx    # Compliance reports
│   │   ├── ReportPayroll.tsx       # Payroll summary reports
│   │   └── ReportBuilder.tsx       # Custom report builder
│   └── Settings/
│       ├── Organization.tsx        # Org settings, fiscal year, tax ID
│       ├── Users.tsx               # User management, invites
│       ├── ChartOfAccounts.tsx     # COA setup wizard
│       ├── TaxSettings.tsx         # Tax jurisdictions, rates
│       ├── ComplianceSettings.tsx  # Compliance category setup
│       ├── PayrollSettings.tsx     # Payroll defaults, deductions
│       ├── Integrations.tsx        # Bank connections, API keys
│       └── Templates.tsx           # Document templates
```

### 5.2 Component Architecture

```
src/components/
├── layout/
│   ├── AppLayout.tsx          # Main shell: sidebar + header + content
│   ├── Sidebar.tsx            # Navigation sidebar with sections
│   ├── Header.tsx             # Top bar: search, notifications, user menu
│   ├── Breadcrumbs.tsx        # Breadcrumb navigation
│   └── PageHeader.tsx         # Page title + action buttons
├── ui/
│   ├── Button.tsx             # All button variants (primary, secondary, danger, ghost)
│   ├── Card.tsx               # Content cards with header/body/footer
│   ├── Modal.tsx              # Dialog modal with overlay
│   ├── Table.tsx              # Data table with sorting, pagination, selection
│   ├── DataGrid.tsx           # Advanced table with inline editing
│   ├── Form.tsx               # Form wrapper with validation
│   ├── Input.tsx              # Text input, number, date, textarea, select
│   ├── Checkbox.tsx           # Checkbox + checkbox group
│   ├── Radio.tsx              # Radio group
│   ├── Toggle.tsx             # Toggle switch
│   ├── Badge.tsx              # Status badges (color-coded)
│   ├── Avatar.tsx             # User avatar
│   ├── Tabs.tsx               # Tab navigation
│   ├── Accordion.tsx          # Expandable sections
│   ├── Dropdown.tsx           # Dropdown menu
│   ├── DatePicker.tsx         # Date picker
│   ├── Calendar.tsx           # Calendar component
│   ├── FileUpload.tsx         # Drag & drop file upload
│   ├── PDFViewer.tsx          # PDF display component
│   ├── Chart.tsx              # Chart wrapper (recharts)
│   ├── StatCard.tsx           # Dashboard stat card with trend
│   ├── EmptyState.tsx         # Empty state illustration + message
│   ├── Loading.tsx            # Loading spinner/skeleton
│   ├── Toast.tsx              # Toast notifications
│   └── Tooltip.tsx            # Hover tooltip
├── financial/
│   ├── AccountTree.tsx         # Hierarchical chart of accounts
│   ├── TransactionRow.tsx      # Transaction list item
│   ├── JournalEntryForm.tsx    # Multi-line journal entry input
│   ├── ReconciliationTable.tsx # Bank reconciliation grid
│   └── BalanceDisplay.tsx      # Running balance display
├── tax/
│   ├── TaxFormStatus.tsx       # Tax form status indicator
│   ├── TaxDeadlineBadge.tsx    # Deadline badge (urgency color)
│   └── TaxYearSelector.tsx     # Tax year dropdown
├── compliance/
│   ├── ComplianceMeter.tsx     # Risk score gauge
│   ├── ComplianceTimeline.tsx  # Timeline of compliance events
│   └── EvidenceUploader.tsx    # Evidence upload + preview
├── payroll/
│   ├── EmployeeCard.tsx        # Employee summary card
│   ├── PayrollRunSummary.tsx   # Payroll run summary panel
│   ├── PayStubPreview.tsx      # Pay stub preview
│   └── DeductionEditor.tsx     # Deduction line item editor
├── w2/
│   ├── W2BoxEditor.tsx         # W2 box-by-box editor
│   ├── W2Preview.tsx           # W2 form preview
│   └── W2StatusBadge.tsx       # W2 status indicator
├── dashboard/
│   ├── KpiGrid.tsx             # KPI card grid
│   ├── ActivityFeed.tsx        # Recent activity list
│   ├── QuickActions.tsx        # Quick action buttons
│   └── ChartWidgets.tsx        # Chart widgets (recharts)
└── shared/
    ├── OrgGuard.tsx            # Organization/role route guard
    ├── DataExport.tsx          # Export to CSV/Excel/PDF
    ├── FilterBar.tsx           # Filter/search bar for lists
    ├── BulkActions.tsx         # Bulk action toolbar
    └── SearchBar.tsx           # Global search
```

### 5.3 Hooks

```
src/hooks/
├── useAuth.ts          # Auth state, login, logout, user info
├── useOrg.ts           # Current organization, settings
├── useContacts.ts      # Contact data hooks (tRPC wrappers)
├── useFinancial.ts     # Financial data hooks
├── useTax.ts          # Tax data hooks
├── useCompliance.ts   # Compliance data hooks
├── useEmployees.ts    # Employee data hooks
├── usePayroll.ts      # Payroll data hooks
├── useW2.ts           # W2 data hooks
├── useDocuments.ts    # Document data hooks
├── useTasks.ts        # Task data hooks
├── useReports.ts      # Report data hooks
├── useAI.ts           # AI generation hooks
├── useToast.ts        # Toast notification hook
├── useModal.ts        # Modal state management
├── useLocalStorage.ts # Local storage hook
└── useDebounce.ts     # Debounce hook for search
```

### 5.4 State & Routing

- **React Router v6** for client-side routing
- **React Query (TanStack Query)** for server state management via tRPC
- **Zustand** for client-side state (auth, UI, modals, sidebar)
- **tRPC React Query** for automatic caching, refetching, invalidation

---

## 6. Implementation Phases

### Phase 1: Foundation & Structure (Week 1-2)

**Goal**: Working project shell with database, auth, and basic navigation.

| Task | Deliverable | Details |
|------|-------------|---------|
| 1.1 | Monorepo setup | Root package.json, workspace scripts, shared types package |
| 1.2 | Database schema | Complete Drizzle schema.ts with all 20+ tables |
| 1.3 | Migrations | Initial SQL migration + seed data (sample org, COA, users) |
| 1.4 | Backend setup | Express + tRPC setup, context with auth, protected procedures |
| 1.5 | Auth system | JWT-based login/register, password hashing, session management |
| 1.6 | Org setup | Organization creation, user invitation, role management |
| 1.7 | Frontend setup | Vite + React + Tailwind + React Router + tRPC client + Zustand |
| 1.8 | Layout shell | AppLayout, Sidebar, Header, navigation structure |
| 1.9 | Dashboard skeleton | Empty dashboard with stat card placeholders |
| 1.10 | Seed data | Default chart of accounts, sample org, admin user |

### Phase 2: CRM & Contacts (Week 2-3)

**Goal**: Full contact management system working.

| Task | Deliverable | Details |
|------|-------------|---------|
| 2.1 | Contact router | Full CRUD with search, filters, pagination |
| 2.2 | Contact service | Deduplication, merge, bulk import (CSV) |
| 2.3 | Contact list page | Table with filters, search, tags, bulk actions |
| 2.4 | Contact detail page | Full profile, communication history, related documents |
| 2.5 | Contact form | Add/edit with validation, address input, tags |
| 2.6 | Communication tracking | Add notes, emails, calls to contact history |
| 2.7 | Task integration | Tasks linked to contacts |
| 2.8 | Document linking | Upload/view docs linked to contacts |
| 2.9 | Dashboard KPIs | Contact stats on dashboard |
| 2.10 | Audit logging | All contact mutations logged |

### Phase 3: Financial Recordkeeping (Week 3-5)

**Goal**: Complete double-entry bookkeeping system.

| Task | Deliverable | Details |
|------|-------------|---------|
| 3.1 | Chart of accounts router | CRUD, tree structure, import default COA |
| 3.2 | COA setup wizard | Pre-built account templates by business type |
| 3.3 | Transaction router | CRUD, filters, search, bulk import |
| 3.4 | Journal entry router | Multi-line JE, posting, reversing |
| 3.5 | Bank account router | Bank account CRUD, balance tracking |
| 3.6 | Reconciliation router | Reconciliation workflow |
| 3.7 | Financial pages | COA tree, transaction list, JE list, bank rec |
| 3.8 | Transaction form | Add/edit transaction with account selection |
| 3.9 | Journal entry form | Multi-line JE editor with balance validation |
| 3.10 | Reconciliation view | Side-by-side bank vs ledger |
| 3.11 | Budget router | Budget setup + variance tracking |
| 3.12 | Financial reports | Trial balance, general ledger |
| 3.13 | Dashboard financials | Financial KPIs, cash position |

### Phase 4: Taxation (Week 5-6)

**Goal**: Tax year management, form tracking, and calculation engine.

| Task | Deliverable | Details |
|------|-------------|---------|
| 4.1 | Tax year router | CRUD, open/close/extend year |
| 4.2 | Tax form router | CRUD, status tracking, deadline management |
| 4.3 | Tax calculation engine | Federal/state/local tax calculations |
| 4.4 | Tax form editor | Per-form data entry (W2, 1099, 941, etc.) |
| 4.5 | Tax pages | Tax years, forms, calculator, dashboard |
| 4.6 | Deadline tracking | Auto-created tasks for filing deadlines |
| 4.7 | Dashboard tax view | Tax summary, upcoming deadlines |
| 4.8 | 1099 support | 1099-NEC, 1099-MISC form tracking |
| 4.9 | Tax reports | Tax summary by year, by form type |
| 4.10 | E-file prep | Data export in standard formats |

### Phase 5: Compliance (Week 6-7)

**Goal**: Compliance tracking with deadlines and evidence.

| Task | Deliverable | Details |
|------|-------------|---------|
| 5.1 | Compliance category router | CRUD for compliance categories |
| 5.2 | Compliance item router | CRUD, status tracking, assignment |
| 5.3 | Compliance document router | Evidence upload/linking |
| 5.4 | Compliance pages | Dashboard, items list, calendar, categories |
| 5.5 | Compliance form | Add/edit item with deadline, assignment |
| 5.6 | Compliance dashboard | Risk score, status overview, upcoming items |
| 5.7 | Calendar view | Deadline calendar with color coding |
| 5.8 | Auto-tasks | Create tasks when items are due |
| 5.9 | Compliance reports | Status reports by category, by assignee |
| 5.10 | Audit readiness | Evidence package export |

### Phase 6: W2 & Payroll (Week 7-9)

**Goal**: Complete payroll processing and W2 generation.

| Task | Deliverable | Details |
|------|-------------|---------|
| 6.1 | Employee router | Full CRUD, bulk import, termination |
| 6.2 | Payroll run router | Create run, add entries, process, void |
| 6.3 | Payroll entry service | Tax calculation per entry |
| 6.4 | Employee pages | List, form, detail, document management |
| 6.5 | Payroll pages | Run list, run form, run detail, pay stub preview |
| 6.6 | W2 router | Generate, preview, distribute, file, correct |
| 6.7 | W2 calculation engine | All box calculations from payroll data |
| 6.8 | W2 pages | Dashboard, list, preview, generate, correct |
| 6.9 | W2 PDF generation | Generate printable W2 form |
| 6.10 | W2c workflow | Correction process for existing W2s |
| 6.11 | Dashboard payroll | Payroll summary, YTD totals |
| 6.12 | Payroll reports | Payroll summary, tax liability, 940/941 prep |

### Phase 7: Documents, Tasks & AI (Week 9-10)

**Goal**: Document management, task workflow, and AI features.

| Task | Deliverable | Details |
|------|-------------|---------|
| 7.1 | Document router | Upload, list, delete, link to entities |
| 7.2 | Document pages | Library, upload, viewer |
| 7.3 | Template router | Template CRUD, variable management |
| 7.4 | Task router | Full CRUD, assignment, completion, reminders |
| 7.5 | Task pages | List, kanban, calendar, form |
| 7.6 | AI router | Document parsing, suggestions, anomaly detection |
| 7.7 | AI pages | Document upload with auto-parse, suggestions |
| 7.8 | Notification system | Email reminders, in-app notifications |
| 7.9 | Cron jobs | Scheduled tasks for deadlines, reminders, snapshots |
| 7.10 | Dashboard completion | All widgets, charts, KPIs populated |

### Phase 8: Reporting & Polish (Week 10-11)

**Goal**: Full reporting suite and production polish.

| Task | Deliverable | Details |
|------|-------------|---------|
| 8.1 | Report router | All financial, tax, compliance, payroll reports |
| 8.2 | Report pages | P&L, balance sheet, cash flow, custom reports |
| 8.3 | Report charts | Recharts integration for visual reports |
| 8.4 | Data export | CSV, Excel, PDF export for all lists/reports |
| 8.5 | Settings pages | All settings modules |
| 8.6 | User profile | Profile, password, preferences |
| 8.7 | Error handling | Error boundaries, toast notifications |
| 8.8 | Loading states | Skeletons, spinners for all pages |
| 8.9 | Responsive design | Mobile-friendly layout |
| 8.10 | Performance | Pagination, virtualization, query optimization |
| 8.11 | Testing | Basic unit tests for critical services |
| 8.12 | Documentation | README, setup guide, API docs |

---

## 7. File Tree (Final)

```
skarion-crm/
├── package.json                          # Root monorepo scripts
├── .env.example                          # Environment variables template
├── .gitignore
├── drizzle.config.ts                     # Drizzle ORM config
├── tsconfig.json                         # Root TypeScript config
│
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── types.ts                  # Shared types between frontend & backend
│
├── server/                                # Backend API
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                      # Express entry point
│   │   ├── trpc.ts                       # tRPC setup + context + middleware
│   │   ├── db/
│   │   │   ├── index.ts                  # Database connection (drizzle + postgres)
│   │   │   ├── schema.ts                 # ALL Drizzle schema definitions
│   │   │   └── seed.ts                   # Seed data script
│   │   ├── routers/
│   │   │   ├── _app.ts                   # Root router composition
│   │   │   ├── org.ts                    # Organization & user management
│   │   │   ├── contact.ts                # Contact CRUD + communications
│   │   │   ├── financial.ts              # COA, transactions, journal entries, bank accounts, reconciliation
│   │   │   ├── tax.ts                    # Tax years, forms, calculations
│   │   │   ├── compliance.ts             # Compliance categories, items, documents
│   │   │   ├── employee.ts               # Employee management
│   │   │   ├── payroll.ts                # Payroll runs & entries
│   │   │   ├── w2.ts                     # W2 generation & management
│   │   │   ├── document.ts               # Document upload & management
│   │   │   ├── task.ts                   # Task management
│   │   │   ├── report.ts                 # Financial & operational reports
│   │   │   └── ai.ts                     # AI-powered endpoints
│   │   ├── services/
│   │   │   ├── audit.ts                  # Audit logging service
│   │   │   ├── auth.ts                   # JWT auth, password hashing
│   │   │   ├── org.ts                    # Organization service
│   │   │   ├── contact.ts                # Contact business logic
│   │   │   ├── financial.ts              # Transaction processing, balance calc, reconciliation
│   │   │   ├── tax.ts                    # Tax calculation engine
│   │   │   ├── compliance.ts             # Compliance evaluation
│   │   │   ├── employee.ts               # Employee CRUD, bulk import
│   │   │   ├── payroll.ts                # Payroll run processing, tax calc
│   │   │   ├── w2.ts                     # W2 box calculations, PDF generation, e-file export
│   │   │   ├── document.ts               # File handling, OCR integration
│   │   │   ├── task.ts                   # Task lifecycle, reminders
│   │   │   ├── report.ts                 # Report generation, caching
│   │   │   ├── ai.ts                     # AI document parsing, suggestions, anomaly detection
│   │   │   └── cron.ts                   # Scheduled jobs (reminders, reconciliations, snapshots)
│   │   └── utils/
│   │       ├── errors.ts                 # Custom error classes
│   │       ├── validators.ts             # Shared validation helpers
│   │       └── pdf.ts                    # PDF generation utilities
│   └── migrations/
│       └── 0000_initial.sql              # Initial migration (generated by drizzle-kit)
│
├── client/                                # Frontend SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                      # React entry point
│       ├── App.tsx                       # Router + providers + layout
│       ├── api.ts                        # tRPC client setup
│       ├── store.ts                      # Zustand store (auth, UI)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   ├── Breadcrumbs.tsx
│       │   │   └── PageHeader.tsx
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Table.tsx
│       │   │   ├── DataGrid.tsx
│       │   │   ├── Form.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Checkbox.tsx
│       │   │   ├── Toggle.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Avatar.tsx
│       │   │   ├── Tabs.tsx
│       │   │   ├── Accordion.tsx
│       │   │   ├── Dropdown.tsx
│       │   │   ├── DatePicker.tsx
│       │   │   ├── Calendar.tsx
│       │   │   ├── FileUpload.tsx
│       │   │   ├── PDFViewer.tsx
│       │   │   ├── Chart.tsx
│       │   │   ├── StatCard.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   ├── Loading.tsx
│       │   │   ├── Toast.tsx
│       │   │   └── Tooltip.tsx
│       │   ├── financial/
│       │   │   ├── AccountTree.tsx
│       │   │   ├── TransactionRow.tsx
│       │   │   ├── JournalEntryForm.tsx
│       │   │   ├── ReconciliationTable.tsx
│       │   │   └── BalanceDisplay.tsx
│       │   ├── tax/
│       │   │   ├── TaxFormStatus.tsx
│       │   │   ├── TaxDeadlineBadge.tsx
│       │   │   └── TaxYearSelector.tsx
│       │   ├── compliance/
│       │   │   ├── ComplianceMeter.tsx
│       │   │   ├── ComplianceTimeline.tsx
│       │   │   └── EvidenceUploader.tsx
│       │   ├── payroll/
│       │   │   ├── EmployeeCard.tsx
│       │   │   ├── PayrollRunSummary.tsx
│       │   │   ├── PayStubPreview.tsx
│       │   │   └── DeductionEditor.tsx
│       │   ├── w2/
│       │   │   ├── W2BoxEditor.tsx
│       │   │   ├── W2Preview.tsx
│       │   │   └── W2StatusBadge.tsx
│       │   ├── dashboard/
│       │   │   ├── KpiGrid.tsx
│       │   │   ├── ActivityFeed.tsx
│       │   │   ├── QuickActions.tsx
│       │   │   └── ChartWidgets.tsx
│       │   └── shared/
│       │       ├── OrgGuard.tsx
│       │       ├── DataExport.tsx
│       │       ├── FilterBar.tsx
│       │       ├── BulkActions.tsx
│       │       └── SearchBar.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Setup.tsx
│       │   ├── Contacts/
│       │   │   ├── ContactList.tsx
│       │   │   ├── ContactDetail.tsx
│       │   │   └── ContactForm.tsx
│       │   ├── Financial/
│       │   │   ├── ChartOfAccounts.tsx
│       │   │   ├── Transactions.tsx
│       │   │   ├── TransactionForm.tsx
│       │   │   ├── JournalEntries.tsx
│       │   │   ├── JournalEntryForm.tsx
│       │   │   ├── BankAccounts.tsx
│       │   │   ├── Reconciliation.tsx
│       │   │   └── Budgets.tsx
│       │   ├── Tax/
│       │   │   ├── TaxYears.tsx
│       │   │   ├── TaxForms.tsx
│       │   │   ├── TaxFormEditor.tsx
│       │   │   ├── TaxCalculator.tsx
│       │   │   └── TaxDashboard.tsx
│       │   ├── Compliance/
│       │   │   ├── ComplianceDashboard.tsx
│       │   │   ├── ComplianceItems.tsx
│       │   │   ├── ComplianceForm.tsx
│       │   │   └── ComplianceCalendar.tsx
│       │   ├── Payroll/
│       │   │   ├── Employees.tsx
│       │   │   ├── EmployeeForm.tsx
│       │   │   ├── EmployeeDetail.tsx
│       │   │   ├── PayrollRuns.tsx
│       │   │   ├── PayrollRunForm.tsx
│       │   │   └── PayrollRunDetail.tsx
│       │   ├── W2/
│       │   │   ├── W2Dashboard.tsx
│       │   │   ├── W2List.tsx
│       │   │   ├── W2Preview.tsx
│       │   │   ├── W2Generate.tsx
│       │   │   └── W2Correct.tsx
│       │   ├── Documents/
│       │   │   ├── DocumentLibrary.tsx
│       │   │   ├── DocumentUpload.tsx
│       │   │   └── DocumentViewer.tsx
│       │   ├── Tasks/
│       │   │   ├── TaskList.tsx
│       │   │   ├── TaskForm.tsx
│       │   │   └── TaskCalendar.tsx
│       │   ├── Reports/
│       │   │   ├── ReportPnl.tsx
│       │   │   ├── ReportBalanceSheet.tsx
│       │   │   ├── ReportCashFlow.tsx
│       │   │   ├── ReportTax.tsx
│       │   │   ├── ReportCompliance.tsx
│       │   │   ├── ReportPayroll.tsx
│       │   │   └── ReportBuilder.tsx
│       │   └── Settings/
│       │       ├── Organization.tsx
│       │       ├── Users.tsx
│       │       ├── ChartOfAccounts.tsx
│       │       ├── TaxSettings.tsx
│       │       ├── ComplianceSettings.tsx
│       │       ├── PayrollSettings.tsx
│       │       ├── Integrations.tsx
│       │       └── Templates.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useOrg.ts
│       │   ├── useContacts.ts
│       │   ├── useFinancial.ts
│       │   ├── useTax.ts
│       │   ├── useCompliance.ts
│       │   ├── useEmployees.ts
│       │   ├── usePayroll.ts
│       │   ├── useW2.ts
│       │   ├── useDocuments.ts
│       │   ├── useTasks.ts
│       │   ├── useReports.ts
│       │   ├── useAI.ts
│       │   ├── useToast.ts
│       │   ├── useModal.ts
│       │   ├── useLocalStorage.ts
│       │   └── useDebounce.ts
│       ├── lib/
│       │   ├── trpc.ts
│       │   ├── utils.ts
│       │   └── constants.ts
│       └── types/
│           └── index.ts
│
└── docs/
    ├── README.md
    ├── SETUP.md
    └── API.md
```

---

## 8. Environment Variables

```bash
# === DATABASE ===
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres

# === AUTH ===
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# === SERVER ===
PORT=4000
NODE_ENV=development
APP_URL=http://localhost:5173
API_URL=http://localhost:4000

# === SUPABASE ===
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# === AI ===
OPENAI_API_KEY=sk-xxxxxxxx
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# === EMAIL ===
RESEND_API_KEY=re_xxxxxxxx
FROM_EMAIL=noreply@skarion.com

# === FILE STORAGE ===
STORAGE_PROVIDER=supabase
```

---

## 9. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Custom JWT auth (not Clerk)** | Simpler for SMB use, no vendor lock-in, easier self-hosting, no external auth dependency |
| **Multi-tenant via org_id** | Every business gets isolated data. Shared users table conceptually but all queries scoped by org. |
| **Soft deletes** | Critical for financial/audit compliance. Nothing is truly deleted, only marked. |
| **Separate audit_log table** | Compliance-grade audit trail independent of application logic. |
| **W2 box model** | Explicit W2 boxes as columns (not JSONB) for validation, querying, and reporting. |
| **SSN hashes (not plain text)** | Security best practice. Only store hashed SSNs. |
| **Payroll calculation in service layer** | Tax calculations are complex and need to be versioned/tested independently of database. |
| **JSONB for address, bank info** | Flexible structure without schema changes. |
| **JSONB for deductions** | Variable deduction types per employee. |
| **Report snapshots** | Pre-computed report data for fast dashboard loading. |
| **Zustand for client state** | Lightweight, simpler than Redux for our needs. |
| **Recharts for charts** | React-native, lightweight, customizable. |
| **PDF generation server-side** | Better control, no client-side PDF library bloat. |
| **drizzle-zod for validation** | Single source of truth for schema + validation. |

---

## 10. Success Criteria

| # | Criterion | How Verified |
|---|-----------|------------|
| 1 | Full double-entry bookkeeping | Debits = Credits on every journal entry, trial balance balances |
| 2 | W2 generation from payroll data | Payroll entries → accurate W2 boxes, printable PDF |
| 3 | Tax calculation accuracy | FICA, FUTA, federal income tax match IRS tables |
| 4 | Compliance tracking | All items trackable, deadline alerts, evidence upload |
| 5 | Multi-tenancy | Organization A cannot see Organization B's data |
| 6 | Audit trail | Every mutation logged with before/after values |
| 7 | Responsive UI | Works on desktop and tablet |
| 8 | Type safety | End-to-end: database → API → frontend, no `any` types |
| 9 | CSV import/export | Contacts, transactions, employees, payroll entries |
| 10 | Document management | Upload, link to entities, preview, download |

---

## 11. Implementation Strategy (How We Build)

### Stage 1: Project Setup & Database (Delegated to Coder sub-agent)
- Create monorepo structure
- Set up root package.json, scripts, shared types
- Write complete Drizzle schema.ts (all tables)
- Generate initial migration
- Create seed data script
- Set up Express + tRPC backend skeleton
- Set up Vite + React + Tailwind frontend skeleton
- Set up Zustand store
- Create AppLayout, Sidebar, Header
- Output: Working project with navigation, no data yet

### Stage 2: Auth & Organization (Delegated to Coder sub-agent)
- JWT auth service (register, login, token refresh)
- Organization creation & management
- User invitation & role management
- Login/Register/Setup pages
- Auth middleware on backend
- Org context on frontend
- Output: Full auth flow, org setup, user management

### Stage 3: CRM & Contacts (Delegated to Coder sub-agent)
- Contact router + service + DB queries
- Contact list, detail, form pages
- Communication tracking
- Bulk import (CSV)
- Search & filters
- Output: Full contact management

### Stage 4: Financial Module (Delegated to Coder sub-agent)
- Chart of accounts router + tree view
- Transaction router + CRUD
- Journal entry router + multi-line editor
- Bank account router + reconciliation
- Financial pages (COA, transactions, JE, bank rec)
- Balance calculations
- Trial balance report
- Output: Complete bookkeeping system

### Stage 5: Tax Module (Delegated to Coder sub-agent)
- Tax year router + management
- Tax form router + editor
- Tax calculation engine
- Tax dashboard
- Deadline tracking with tasks
- Output: Tax preparation system

### Stage 6: Compliance Module (Delegated to Coder sub-agent)
- Compliance category + item routers
- Compliance dashboard with risk meter
- Calendar view
- Evidence upload
- Output: Compliance tracking system

### Stage 7: Payroll & W2 Module (Delegated to Coder sub-agent)
- Employee router + pages
- Payroll run router + entry editor
- Tax calculation per entry
- W2 generation from payroll
- W2 PDF preview
- W2c correction workflow
- Output: Payroll + W2 system

### Stage 8: Documents, Tasks, Reports, AI (Delegated to Coder sub-agent)
- Document upload + library + viewer
- Task management (list + kanban + calendar)
- Financial reports (P&L, balance sheet, cash flow)
- Tax, compliance, payroll reports
- AI document parsing endpoint
- Dashboard completion
- Settings pages
- Output: Complete system

### Stage 9: Integration & Final Assembly (Orchestrator)
- Wire all frontend routes
- Connect all tRPC endpoints
- Final dashboard with real data
- Error handling, loading states
- Export functionality
- Final testing
- README + setup docs
- Output: Complete, buildable Skarion CRM v2.0

---

## 12. Data Flow Diagrams

### W2 Generation Flow
```
Payroll Runs → Payroll Entries → W2 Calculation Service → W2 Boxes → W2 PDF Generator → W2 Forms Table
     ↓              ↓                    ↓                                          ↓
 Employee    Tax Rates         FICA/FUTA/Income Tax                        E-file Export (XML)
 Data        (2024/2025)       Calculations                                 → SSA/IRS
```

### Financial Record Flow
```
Transaction Form → Journal Entry Service → Journal Entry Lines → Account Balances
       ↓                    ↓                    ↓                    ↓
   Bank Account      Double-Entry Validation   Debit = Credit       Trial Balance
   Reconciliation    (real-time)                                     Balance Sheet
                                                                   P&L
```

### Compliance Flow
```
Compliance Category → Compliance Item → Due Date Tracking → Task Creation
       ↓                      ↓                ↓                  ↓
   Requirements          Evidence           Reminders        Email/Notification
   (IRS, OSHA, etc.)     Upload             (7, 3, 1 days)   Assignment
```

---

## 13. Quality Gates

Before each stage advances:

1. **Type check**: `tsc --noEmit` passes on both server and client
2. **Schema valid**: Drizzle schema compiles, migration generates without error
3. **Router tests**: Each tRPC router can be called without runtime errors (manual testing via curl or test page)
4. **UI renders**: All pages in the stage render without crashing
5. **Data flows**: Frontend can create, read, update, and delete data through the API
6. **Audit logs**: Every mutation in the stage writes to audit_log
7. **Multi-tenant**: All queries scoped by org_id, no cross-tenant leakage

---

## Plan Complete. Proceed to Execution.
