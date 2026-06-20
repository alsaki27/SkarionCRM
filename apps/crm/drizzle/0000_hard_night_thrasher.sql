CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TYPE "crm"."activity_type" AS ENUM('call', 'email', 'meeting', 'note');--> statement-breakpoint
CREATE TYPE "crm"."currency" AS ENUM('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'AED', 'SAR');--> statement-breakpoint
CREATE TYPE "crm"."lead_source" AS ENUM('website', 'referral', 'social_media', 'cold_call', 'email_campaign', 'event', 'other');--> statement-breakpoint
CREATE TYPE "crm"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'disqualified', 'converted');--> statement-breakpoint
CREATE TYPE "crm"."opportunity_stage" AS ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TABLE "crm"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "crm"."activity_type" NOT NULL,
	"subject" text NOT NULL,
	"content" text,
	"contact_id" uuid,
	"company_id" uuid,
	"opportunity_id" uuid,
	"actor_id" uuid NOT NULL,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"app" text DEFAULT 'crm' NOT NULL,
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
CREATE TABLE "crm"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"address" jsonb,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text,
	"company_id" uuid,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company_name" text,
	"company_domain" text,
	"source" "crm"."lead_source" DEFAULT 'other' NOT NULL,
	"status" "crm"."lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"converted_to_contact_id" uuid,
	"converted_to_company_id" uuid,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"stage" "crm"."opportunity_stage" DEFAULT 'prospecting' NOT NULL,
	"amount" numeric(14, 2),
	"currency" "crm"."currency" DEFAULT 'USD' NOT NULL,
	"expected_close_date" date,
	"probability" integer,
	"owner_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"assignee_id" uuid NOT NULL,
	"contact_id" uuid,
	"company_id" uuid,
	"opportunity_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD CONSTRAINT "tasks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_contact" ON "crm"."activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_activities_company" ON "crm"."activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_activities_opportunity" ON "crm"."activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_activities_actor" ON "crm"."activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_activities_type" ON "crm"."activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_activities_happened" ON "crm"."activities" USING btree ("happened_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "crm"."audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "crm"."audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "crm"."audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_companies_name" ON "crm"."companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_companies_owner" ON "crm"."companies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_companies_industry" ON "crm"."companies" USING btree ("industry");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_companies_domain_lower" ON "crm"."companies" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_contacts_company" ON "crm"."contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_owner" ON "crm"."contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_email_lower" ON "crm"."contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_name" ON "crm"."contacts" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "crm"."leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_source" ON "crm"."leads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_leads_owner" ON "crm"."leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_leads_email_lower" ON "crm"."leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_leads_created" ON "crm"."leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_opportunities_stage" ON "crm"."opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_opportunities_owner" ON "crm"."opportunities" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_opportunities_company" ON "crm"."opportunities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_opportunities_close_date" ON "crm"."opportunities" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "idx_opportunities_created" ON "crm"."opportunities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "crm"."tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_contact" ON "crm"."tasks" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_company" ON "crm"."tasks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_opportunity" ON "crm"."tasks" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_due" ON "crm"."tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_completed" ON "crm"."tasks" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_priority" ON "crm"."tasks" USING btree ("priority");