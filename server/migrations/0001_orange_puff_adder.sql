CREATE TYPE "public"."activity_type" AS ENUM('login', 'logout', 'create', 'update', 'delete', 'invite', 'export', 'import', 'payment', 'file_upload', 'file_download', 'settings_change', 'subscription_change', 'invoice_sent', 'invoice_paid', 'invoice_overdue', 'payroll_run', 'tax_filed', 'compliance_completed', 'w2_generated', '1099_generated', 'ai_action');--> statement-breakpoint
CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'disconnected', 'error', 'pending_auth');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('greenhouse', 'lever', 'workday', 'bamboohr', 'gusto', 'quickbooks', 'stripe', 'zapier', 'custom');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'sms', 'push', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'error', 'mention', 'task', 'payment', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('monthly', 'yearly', 'lifetime');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"actor_name" varchar(255),
	"actor_type" varchar(50) DEFAULT 'user',
	"type" "activity_type" NOT NULL,
	"description" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"entity_name" varchar(255),
	"metadata" jsonb DEFAULT '{}',
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"model" varchar(100) DEFAULT 'gpt-4o',
	"messages" jsonb DEFAULT '[]',
	"summary" text,
	"tokens_used" integer DEFAULT 0,
	"cost_estimate" numeric(10, 4) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"key_hash" text NOT NULL,
	"permissions" text[] DEFAULT '{}',
	"rate_limit" integer DEFAULT 1000,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"status" "api_key_status" DEFAULT 'active',
	"metadata" jsonb DEFAULT '{}',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false,
	"value" jsonb DEFAULT '{}',
	"rollout_percentage" integer DEFAULT 100,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"file_path" text,
	"raw_data" jsonb DEFAULT '{}',
	"mapped_fields" jsonb DEFAULT '{}',
	"status" varchar(50) DEFAULT 'pending',
	"total_rows" integer DEFAULT 0,
	"processed_rows" integer DEFAULT 0,
	"success_rows" integer DEFAULT 0,
	"error_rows" integer DEFAULT 0,
	"errors" jsonb DEFAULT '[]',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "integration_type" NOT NULL,
	"status" "integration_status" DEFAULT 'pending_auth',
	"credentials" jsonb DEFAULT '{}',
	"config" jsonb DEFAULT '{}',
	"last_sync_at" timestamp with time zone,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"sync_frequency" varchar(50) DEFAULT 'daily',
	"metadata" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" DEFAULT 'info',
	"title" varchar(255) NOT NULL,
	"body" text,
	"link" text,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"channels" "notification_channel"[] DEFAULT '{}',
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'viewer',
	"token" text NOT NULL,
	"invited_by" uuid,
	"accepted_by" uuid,
	"status" "invite_status" DEFAULT 'pending',
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "org_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"price_monthly" numeric(10, 2) DEFAULT '0',
	"price_yearly" numeric(10, 2) DEFAULT '0',
	"interval" "plan_interval" DEFAULT 'monthly',
	"max_users" integer DEFAULT 1,
	"max_contacts" integer DEFAULT 100,
	"max_employees" integer DEFAULT 5,
	"max_invoices" integer DEFAULT 50,
	"max_transactions" integer DEFAULT 500,
	"max_storage_mb" integer DEFAULT 100,
	"features" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing',
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" text[] DEFAULT '{}',
	"status" "webhook_status" DEFAULT 'active',
	"last_delivered_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"attempt_count" integer DEFAULT 1,
	"max_attempts" integer DEFAULT 5,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_email" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_status" varchar(50) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_org" ON "activity_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_activity_user" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_type" ON "activity_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_activity_entity" ON "activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_created" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_conv_org" ON "ai_conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conv_user" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conv_created" ON "ai_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_apikey_org" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_apikey_status" ON "api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_apikey_prefix" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feature_org_key" ON "feature_flags" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "idx_feature_org" ON "feature_flags" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_import_org" ON "import_jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_import_status" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_import_type" ON "import_jobs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_integration_org" ON "integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_integration_type" ON "integrations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_integration_status" ON "integrations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_integration_org_type" ON "integrations" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "idx_notif_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notif_org" ON "notifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_notif_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notif_read" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "idx_notif_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invite_token" ON "org_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_invite_org" ON "org_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_invite_email" ON "org_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invite_status" ON "org_invites" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sub_org" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_sub_plan" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_sub_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_org" ON "webhook_endpoints" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_status" ON "webhook_endpoints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_event_org" ON "webhook_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_event_endpoint" ON "webhook_events" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_event_type" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_event_created" ON "webhook_events" USING btree ("created_at");