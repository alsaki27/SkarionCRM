CREATE SCHEMA "books";
--> statement-breakpoint
CREATE TYPE "books"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "books"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "books"."transaction_status" AS ENUM('draft', 'posted');--> statement-breakpoint
CREATE TABLE "books"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" "books"."account_type" NOT NULL,
	"description" text,
	"parent_id" uuid,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "books"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"app" text DEFAULT 'books' NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books"."invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"tax_code_id" uuid,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "books"."invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "books"."tax_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"jurisdiction" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "books"."transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(14, 2),
	"credit" numeric(14, 2),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"reference" text,
	"status" "books"."transaction_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "books"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "books"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books"."invoice_items" ADD CONSTRAINT "invoice_items_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "books"."tax_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books"."transaction_lines" ADD CONSTRAINT "transaction_lines_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "books"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books"."transaction_lines" ADD CONSTRAINT "transaction_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "books"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_name" ON "books"."accounts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_accounts_code" ON "books"."accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_accounts_type" ON "books"."accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_accounts_owner" ON "books"."accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_name_lower" ON "books"."accounts" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "books"."audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "books"."audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "books"."audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "books"."invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "books"."invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "books"."invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_owner" ON "books"."invoices" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "books"."invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_tax_codes_name" ON "books"."tax_codes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tax_codes_jurisdiction" ON "books"."tax_codes" USING btree ("jurisdiction");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tax_codes_name_lower" ON "books"."tax_codes" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_transaction_lines_transaction" ON "books"."transaction_lines" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_lines_account" ON "books"."transaction_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "books"."transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_transactions_status" ON "books"."transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transactions_owner" ON "books"."transactions" USING btree ("owner_id");