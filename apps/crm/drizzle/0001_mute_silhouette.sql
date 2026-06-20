CREATE TYPE "crm"."integration_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "crm"."workflow_trigger" AS ENUM('lead_created', 'opportunity_stale', 'task_due_soon');--> statement-breakpoint
CREATE TABLE "crm"."integration_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"status" "crm"."integration_status" DEFAULT 'disconnected' NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."workflow_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trigger" "crm"."workflow_trigger" NOT NULL,
	"conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "crm"."idx_companies_domain_lower";--> statement-breakpoint
DROP INDEX "crm"."idx_contacts_email_lower";--> statement-breakpoint
DROP INDEX "crm"."idx_leads_email_lower";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_integrations_provider" ON "crm"."integration_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_workflow_rules_trigger" ON "crm"."workflow_rules" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_workflow_rules_enabled" ON "crm"."workflow_rules" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_companies_domain_lower" ON "crm"."companies" USING btree (lower("domain"));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_email_lower" ON "crm"."contacts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "idx_leads_email_lower" ON "crm"."leads" USING btree (lower("email"));