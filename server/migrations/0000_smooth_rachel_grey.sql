CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'login', 'logout', 'export', 'view', 'post', 'void');--> statement-breakpoint
CREATE TYPE "public"."compliance_item_status" AS ENUM('not_started', 'in_progress', 'compliant', 'non_compliant', 'at_risk', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."compliance_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('client', 'vendor', 'employee', 'contractor', 'prospect', 'partner');--> statement-breakpoint
CREATE TYPE "public"."debit_credit" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."document_template_type" AS ENUM('w2', '1099', 'contract', 'invoice', 'letter', 'compliance', 'paystub', 'other');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'terminated', 'on_leave', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contractor', 'intern');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed');--> statement-breakpoint
CREATE TYPE "public"."form_1099_status" AS ENUM('draft', 'generated', 'distributed', 'filed', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."form_1099_type" AS ENUM('nec', 'misc', 'int', 'div', 'r', 's', 'k');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_status" AS ENUM('draft', 'posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('hourly', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('salary', 'hourly', 'commission', 'piece_rate');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'ach', 'wire', 'credit_card', 'debit_card', 'stripe', 'paypal', 'other');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'processing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'annually');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done', 'cancelled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('follow_up', 'review', 'filing_deadline', 'compliance_review', 'tax_preparation', 'payment', 'reconciliation', 'general');--> statement-breakpoint
CREATE TYPE "public"."tax_form_status" AS ENUM('draft', 'ready', 'filed', 'amended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tax_form_type" AS ENUM('w2', 'w2c', '1099_nec', '1099_misc', '940', '941', '944', '1040', '1120', '1065', '990', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_year_status" AS ENUM('open', 'closed', 'filing', 'extended');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdrawal', 'transfer', 'adjustment', 'journal_entry');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'accountant', 'bookkeeper', 'viewer', 'employee');--> statement-breakpoint
CREATE TYPE "public"."w2_form_status" AS ENUM('draft', 'generated', 'distributed', 'filed', 'corrected');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"bank_name" varchar(255),
	"account_number_hash" varchar(255),
	"account_type" varchar(50),
	"routing_number" varchar(20),
	"currency" varchar(3) DEFAULT 'USD',
	"opening_balance" numeric(15, 2) DEFAULT '0',
	"current_balance" numeric(15, 2) DEFAULT '0',
	"last_reconciled_at" timestamp with time zone,
	"last_reconciled_balance" numeric(15, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_type" varchar(20) DEFAULT 'annual',
	"status" varchar(20) DEFAULT 'draft',
	"account_id" uuid,
	"amount" numeric(15, 2) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"account_subtype" varchar(100),
	"parent_id" uuid,
	"level" integer DEFAULT 1,
	"is_bank_account" boolean DEFAULT false,
	"bank_account_id" uuid,
	"is_active" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"regulatory_body" varchar(255),
	"frequency" varchar(50),
	"priority" "compliance_priority" DEFAULT 'medium',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"compliance_item_id" uuid,
	"document_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"uploaded_by" uuid,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "compliance_item_status" DEFAULT 'not_started',
	"due_date" date,
	"completed_date" date,
	"assigned_to" uuid,
	"reviewer" uuid,
	"evidence_required" boolean DEFAULT false,
	"evidence_files" jsonb DEFAULT '[]',
	"next_review_date" date,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"type" "contact_type" NOT NULL,
	"status" "contact_status" DEFAULT 'active',
	"company_name" varchar(255),
	"tax_id" varchar(50),
	"address" jsonb DEFAULT '{}',
	"tags" text[] DEFAULT '{}',
	"notes" text,
	"last_contacted_at" timestamp with time zone,
	"assigned_to" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"template_type" "document_template_type" NOT NULL,
	"file_path" text,
	"variables" jsonb DEFAULT '[]',
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"storage_provider" varchar(20) DEFAULT 'supabase',
	"uploaded_by" uuid,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid,
	"employee_id" varchar(50) NOT NULL,
	"ssn_hash" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"hire_date" date NOT NULL,
	"termination_date" date,
	"status" "employee_status" DEFAULT 'active',
	"employment_type" "employment_type" DEFAULT 'full_time',
	"job_title" varchar(255),
	"department" varchar(100),
	"pay_rate" numeric(10, 2),
	"pay_frequency" "pay_frequency",
	"pay_type" "pay_type" DEFAULT 'salary',
	"address" jsonb DEFAULT '{}',
	"bank_account" jsonb DEFAULT '{}',
	"withholding_federal" numeric(10, 2) DEFAULT '0',
	"withholding_state" varchar(10),
	"withholding_state_amount" numeric(10, 2) DEFAULT '0',
	"withholding_local" numeric(10, 2) DEFAULT '0',
	"retirement_401k_rate" numeric(5, 2) DEFAULT '0',
	"health_insurance_premium" numeric(10, 2) DEFAULT '0',
	"other_deductions" jsonb DEFAULT '[]',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expense_report_id" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'USD',
	"vendor" varchar(255),
	"receipt_path" text,
	"receipt_uploaded" boolean DEFAULT false,
	"is_billable" boolean DEFAULT false,
	"invoice_id" uuid,
	"mileage" numeric(8, 2),
	"approved" boolean DEFAULT false,
	"approved_by" uuid,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"report_name" varchar(255) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "expense_status" DEFAULT 'draft',
	"total_amount" numeric(15, 2) DEFAULT '0',
	"reimbursed_amount" numeric(15, 2) DEFAULT '0',
	"submitted_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_1099s" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"form_type" "form_1099_type" DEFAULT 'nec' NOT NULL,
	"form_status" "form_1099_status" DEFAULT 'draft',
	"box_1" numeric(15, 2) DEFAULT '0',
	"box_2" numeric(15, 2) DEFAULT '0',
	"box_3" numeric(15, 2) DEFAULT '0',
	"box_4" numeric(15, 2) DEFAULT '0',
	"box_5" numeric(15, 2) DEFAULT '0',
	"box_6" numeric(15, 2) DEFAULT '0',
	"box_7_direct_sales" boolean DEFAULT false,
	"box_8" numeric(15, 2) DEFAULT '0',
	"box_9" numeric(15, 2) DEFAULT '0',
	"box_10" numeric(15, 2) DEFAULT '0',
	"box_11" numeric(15, 2) DEFAULT '0',
	"box_13" numeric(15, 2) DEFAULT '0',
	"box_14" numeric(15, 2) DEFAULT '0',
	"state_taxes" jsonb DEFAULT '[]',
	"state_info" jsonb DEFAULT '[]',
	"corrected_1099_id" uuid,
	"copy_distributed_at" timestamp with time zone,
	"irs_filed_at" timestamp with time zone,
	"generated_pdf_path" text,
	"total_payments" numeric(15, 2) DEFAULT '0',
	"payment_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1',
	"unit_price" numeric(15, 2) DEFAULT '0',
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount_amount" numeric(15, 2) DEFAULT '0',
	"account_id" uuid,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"contact_id" uuid NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "invoice_status" DEFAULT 'draft',
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount_amount" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(15, 2) DEFAULT '0',
	"amount_due" numeric(15, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"terms" varchar(255),
	"po_number" varchar(100),
	"notes" text,
	"footer" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"template" varchar(50) DEFAULT 'default',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"entry_date" date NOT NULL,
	"reference" varchar(255),
	"description" text,
	"status" "journal_entry_status" DEFAULT 'draft',
	"is_reversing_entry" boolean DEFAULT false,
	"reversed_entry_id" uuid,
	"total_debit" numeric(15, 2) NOT NULL,
	"total_credit" numeric(15, 2) NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"debit_credit" "debit_credit" NOT NULL,
	"contact_id" uuid,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"tax_id" varchar(50),
	"business_type" varchar(50),
	"industry" varchar(100),
	"address" jsonb DEFAULT '{}',
	"phone" varchar(50),
	"email" varchar(255),
	"website" varchar(255),
	"fiscal_year_end" varchar(5),
	"timezone" varchar(50) DEFAULT 'America/New_York',
	"currency" varchar(3) DEFAULT 'USD',
	"plan" varchar(50) DEFAULT 'free',
	"status" "organization_status" DEFAULT 'active',
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid,
	"contact_id" uuid,
	"payment_date" date NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'check',
	"reference_number" varchar(255),
	"memo" text,
	"bank_account_id" uuid,
	"deposited_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"regular_hours" numeric(8, 2) DEFAULT '0',
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"gross_pay" numeric(15, 2) NOT NULL,
	"federal_tax" numeric(15, 2) DEFAULT '0',
	"social_security_tax" numeric(15, 2) DEFAULT '0',
	"medicare_tax" numeric(15, 2) DEFAULT '0',
	"state_tax" numeric(15, 2) DEFAULT '0',
	"local_tax" numeric(15, 2) DEFAULT '0',
	"retirement_401k" numeric(15, 2) DEFAULT '0',
	"health_insurance" numeric(15, 2) DEFAULT '0',
	"other_deductions" numeric(15, 2) DEFAULT '0',
	"net_pay" numeric(15, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_name" varchar(255) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft',
	"total_gross" numeric(15, 2) DEFAULT '0',
	"total_fica" numeric(15, 2) DEFAULT '0',
	"total_federal_tax" numeric(15, 2) DEFAULT '0',
	"total_state_tax" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"total_net" numeric(15, 2) DEFAULT '0',
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"transaction_type" "transaction_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"debit_credit" "debit_credit" NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_run_date" date NOT NULL,
	"last_run_date" date,
	"day_of_month" integer,
	"is_active" boolean DEFAULT true,
	"auto_post" boolean DEFAULT false,
	"total_runs" integer DEFAULT 0,
	"max_runs" integer,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"type" "task_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"status" "task_status" DEFAULT 'todo',
	"priority" "task_priority" DEFAULT 'medium',
	"assigned_to" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"reminder_sent_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"form_type" "tax_form_type" NOT NULL,
	"calculation_type" varchar(50) NOT NULL,
	"base_amount" numeric(15, 2) NOT NULL,
	"rate" numeric(10, 6) DEFAULT '0',
	"calculated_amount" numeric(15, 2) NOT NULL,
	"jurisdiction" varchar(100),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"form_type" "tax_form_type" NOT NULL,
	"form_name" varchar(255) NOT NULL,
	"status" "tax_form_status" DEFAULT 'draft',
	"filing_deadline" date NOT NULL,
	"filed_date" date,
	"irs_acknowledgment" varchar(255),
	"efile_transmission_id" varchar(255),
	"amount" numeric(15, 2),
	"contact_id" uuid,
	"prepared_by" uuid,
	"reviewed_by" uuid,
	"metadata" jsonb DEFAULT '{}',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "tax_year_status" DEFAULT 'open',
	"form_types" text[] DEFAULT '{}',
	"extension_filed" boolean DEFAULT false,
	"extension_deadline" date,
	"filed_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"contact_id" uuid,
	"transaction_type" "transaction_type" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"debit_credit" "debit_credit" NOT NULL,
	"reference_number" varchar(255),
	"transaction_date" date NOT NULL,
	"memo" text,
	"attachments" jsonb DEFAULT '[]',
	"is_reconciled" boolean DEFAULT false,
	"reconciled_at" timestamp with time zone,
	"reconciled_by" uuid,
	"metadata" jsonb DEFAULT '{}',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" varchar(50),
	"avatar_url" text,
	"password_hash" varchar(255),
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "w2_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"form_status" "w2_form_status" DEFAULT 'draft',
	"box_1_wages" numeric(15, 2) DEFAULT '0',
	"box_2_federal_tax" numeric(15, 2) DEFAULT '0',
	"box_3_social_wages" numeric(15, 2) DEFAULT '0',
	"box_4_social_tax" numeric(15, 2) DEFAULT '0',
	"box_5_medicare_wages" numeric(15, 2) DEFAULT '0',
	"box_6_medicare_tax" numeric(15, 2) DEFAULT '0',
	"box_7_social_tips" numeric(15, 2) DEFAULT '0',
	"box_8_allocated_tips" numeric(15, 2) DEFAULT '0',
	"box_10_dependent_care" numeric(15, 2) DEFAULT '0',
	"box_11_nonqualified_plans" numeric(15, 2) DEFAULT '0',
	"box_12_codes" jsonb DEFAULT '[]',
	"box_13_checkboxes" jsonb DEFAULT '{}',
	"box_14_other" jsonb DEFAULT '[]',
	"state_wages" jsonb DEFAULT '[]',
	"local_wages" jsonb DEFAULT '[]',
	"employee_copy_distributed_at" timestamp with time zone,
	"irs_filed_at" timestamp with time zone,
	"ssa_filed_at" timestamp with time zone,
	"generated_pdf_path" text,
	"corrected_w2_id" uuid,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_chart_of_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_categories" ADD CONSTRAINT "compliance_categories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_compliance_item_id_compliance_items_id_fk" FOREIGN KEY ("compliance_item_id") REFERENCES "public"."compliance_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_category_id_compliance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."compliance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_reviewer_users_id_fk" FOREIGN KEY ("reviewer") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_communications" ADD CONSTRAINT "contact_communications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_communications" ADD CONSTRAINT "contact_communications_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_communications" ADD CONSTRAINT "contact_communications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_report_id_expense_reports_id_fk" FOREIGN KEY ("expense_report_id") REFERENCES "public"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_1099s" ADD CONSTRAINT "form_1099s_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_1099s" ADD CONSTRAINT "form_1099s_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_1099s" ADD CONSTRAINT "form_1099s_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_1099s" ADD CONSTRAINT "form_1099s_corrected_1099_id_form_1099s_id_fk" FOREIGN KEY ("corrected_1099_id") REFERENCES "public"."form_1099s"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversed_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_prepared_by_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_years" ADD CONSTRAINT "tax_years_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2_forms" ADD CONSTRAINT "w2_forms_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2_forms" ADD CONSTRAINT "w2_forms_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2_forms" ADD CONSTRAINT "w2_forms_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "w2_forms" ADD CONSTRAINT "w2_forms_corrected_w2_id_w2_forms_id_fk" FOREIGN KEY ("corrected_w2_id") REFERENCES "public"."w2_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_org" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bank_org" ON "bank_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_bank_active" ON "bank_accounts" USING btree ("is_active") WHERE "bank_accounts"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_budget_org" ON "budgets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_budget_year" ON "budgets" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_budget_account" ON "budgets" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coa_org_code" ON "chart_of_accounts" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "idx_coa_org" ON "chart_of_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_coa_type" ON "chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_coa_parent" ON "chart_of_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_coa_active" ON "chart_of_accounts" USING btree ("is_active") WHERE "chart_of_accounts"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_comp_cat_org" ON "compliance_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_comp_cat_active" ON "compliance_categories" USING btree ("is_active") WHERE "compliance_categories"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_comp_doc_item" ON "compliance_documents" USING btree ("compliance_item_id");--> statement-breakpoint
CREATE INDEX "idx_comp_doc_org" ON "compliance_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_comp_item_org" ON "compliance_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_comp_item_category" ON "compliance_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_comp_item_status" ON "compliance_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_comp_item_due" ON "compliance_items" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_comp_item_assigned" ON "compliance_items" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_comp_item_next_review" ON "compliance_items" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_comm_contact" ON "contact_communications" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_comm_created" ON "contact_communications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contacts_org" ON "contacts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_type" ON "contacts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_contacts_status" ON "contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contacts_name" ON "contacts" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_assigned" ON "contacts" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_contacts_deleted" ON "contacts" USING btree ("deleted_at") WHERE "contacts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_doc_template_org" ON "document_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_doc_template_type" ON "document_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_doc_template_active" ON "document_templates" USING btree ("is_active") WHERE "document_templates"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_doc_org" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_doc_entity" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_doc_uploaded" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_doc_created" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employee_org_id" ON "employees" USING btree ("org_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_org" ON "employees" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_employee_status" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_employee_contact" ON "employees" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_employee_name" ON "employees" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_expense_item_report" ON "expense_items" USING btree ("expense_report_id");--> statement-breakpoint
CREATE INDEX "idx_expense_item_org" ON "expense_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_expense_item_date" ON "expense_items" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_expense_item_category" ON "expense_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_expense_item_invoice" ON "expense_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_expense_report_org" ON "expense_reports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_expense_report_employee" ON "expense_reports" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expense_report_status" ON "expense_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_report_period" ON "expense_reports" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_1099_contact_year" ON "form_1099s" USING btree ("contact_id","tax_year_id","form_type");--> statement-breakpoint
CREATE INDEX "idx_1099_org" ON "form_1099s" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_1099_contact" ON "form_1099s" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_1099_year" ON "form_1099s" USING btree ("tax_year_id");--> statement-breakpoint
CREATE INDEX "idx_1099_status" ON "form_1099s" USING btree ("form_status");--> statement-breakpoint
CREATE INDEX "idx_1099_corrected" ON "form_1099s" USING btree ("corrected_1099_id");--> statement-breakpoint
CREATE INDEX "idx_inv_line_invoice" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_inv_line_org" ON "invoice_lines" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_inv_line_account" ON "invoice_lines" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoice_org_number" ON "invoices" USING btree ("org_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoice_org" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_contact" ON "invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoice_due" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_issue" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_overdue" ON "invoices" USING btree ("due_date") WHERE "invoices"."status" NOT IN ('paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE UNIQUE INDEX "idx_je_org_number" ON "journal_entries" USING btree ("org_id","entry_number");--> statement-breakpoint
CREATE INDEX "idx_je_org" ON "journal_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_je_date" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_je_status" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_je_created" ON "journal_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_jel_entry" ON "journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_jel_account" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_jel_contact" ON "journal_entry_lines" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_payment_org" ON "payments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_payment_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_contact" ON "payments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_payment_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payment_bank" ON "payments" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_entry_run" ON "payroll_entries" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_entry_employee" ON "payroll_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_entry_org" ON "payroll_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_org" ON "payroll_runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_period" ON "payroll_runs" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_payroll_status" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_paydate" ON "payroll_runs" USING btree ("pay_date");--> statement-breakpoint
CREATE INDEX "idx_recurring_org" ON "recurring_transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_account" ON "recurring_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_contact" ON "recurring_transactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_active" ON "recurring_transactions" USING btree ("is_active") WHERE "recurring_transactions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_recurring_next" ON "recurring_transactions" USING btree ("next_run_date");--> statement-breakpoint
CREATE INDEX "idx_recurring_freq" ON "recurring_transactions" USING btree ("frequency");--> statement-breakpoint
CREATE INDEX "idx_report_org" ON "report_snapshots" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_report_type" ON "report_snapshots" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_report_period" ON "report_snapshots" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_report_generated" ON "report_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_task_org" ON "tasks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_task_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_task_priority" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_task_due" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_task_assigned" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_task_entity" ON "tasks" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_task_overdue" ON "tasks" USING btree ("due_at") WHERE "tasks"."status" NOT IN ('done', 'cancelled');--> statement-breakpoint
CREATE INDEX "idx_tax_calc_org" ON "tax_calculations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tax_calc_year" ON "tax_calculations" USING btree ("tax_year_id");--> statement-breakpoint
CREATE INDEX "idx_tax_calc_type" ON "tax_calculations" USING btree ("calculation_type");--> statement-breakpoint
CREATE INDEX "idx_tax_form_org" ON "tax_forms" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tax_form_year" ON "tax_forms" USING btree ("tax_year_id");--> statement-breakpoint
CREATE INDEX "idx_tax_form_type" ON "tax_forms" USING btree ("form_type");--> statement-breakpoint
CREATE INDEX "idx_tax_form_status" ON "tax_forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tax_form_deadline" ON "tax_forms" USING btree ("filing_deadline");--> statement-breakpoint
CREATE INDEX "idx_tax_form_contact" ON "tax_forms" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tax_year_org_year" ON "tax_years" USING btree ("org_id","year");--> statement-breakpoint
CREATE INDEX "idx_tax_year_org" ON "tax_years" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tax_year_status" ON "tax_years" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_txn_org" ON "transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_txn_account" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_txn_date" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_txn_contact" ON "transactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_txn_bank" ON "transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_txn_reconciled" ON "transactions" USING btree ("is_reconciled") WHERE "transactions"."is_reconciled" = false;--> statement-breakpoint
CREATE INDEX "idx_txn_created" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_org_email" ON "users" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "idx_users_org" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("is_active") WHERE "users"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_w2_employee_year" ON "w2_forms" USING btree ("employee_id","tax_year_id");--> statement-breakpoint
CREATE INDEX "idx_w2_org" ON "w2_forms" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_w2_employee" ON "w2_forms" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_w2_year" ON "w2_forms" USING btree ("tax_year_id");--> statement-breakpoint
CREATE INDEX "idx_w2_status" ON "w2_forms" USING btree ("form_status");--> statement-breakpoint
CREATE INDEX "idx_w2_corrected" ON "w2_forms" USING btree ("corrected_w2_id");