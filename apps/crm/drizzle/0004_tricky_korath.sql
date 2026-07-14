-- 0004 outreach revamp: lead_channels, import_batches, lead_attachments,
-- leadNumber, batchId, taskId, activity_type + lead_source enum extensions,
-- workflow_trigger outreach_stale, lead_channel_stage + outreach_channel enums.
-- Backfills leadNumber + lead_channels for existing leads.

CREATE TYPE "crm"."lead_channel_stage" AS ENUM('not_started', 'connection_request_sent', 'connection_accepted', 'message_sent', 'awaiting_reply', 'in_conversation', 'warm_up_needed', 'replied', 'booked_call', 'no_response');--> statement-breakpoint
CREATE TYPE "crm"."outreach_channel" AS ENUM('linkedin', 'instagram', 'facebook', 'whatsapp', 'email', 'phone');--> statement-breakpoint
ALTER TYPE "crm"."activity_type" ADD VALUE 'linkedin_outreach';--> statement-breakpoint
ALTER TYPE "crm"."activity_type" ADD VALUE 'instagram_outreach';--> statement-breakpoint
ALTER TYPE "crm"."activity_type" ADD VALUE 'facebook_outreach';--> statement-breakpoint
ALTER TYPE "crm"."activity_type" ADD VALUE 'whatsapp_outreach';--> statement-breakpoint
ALTER TYPE "crm"."activity_type" ADD VALUE 'phone_outreach';--> statement-breakpoint
ALTER TYPE "crm"."lead_source" ADD VALUE 'linkedin' BEFORE 'website';--> statement-breakpoint
ALTER TYPE "crm"."lead_source" ADD VALUE 'facebook' BEFORE 'website';--> statement-breakpoint
ALTER TYPE "crm"."lead_source" ADD VALUE 'instagram' BEFORE 'website';--> statement-breakpoint
ALTER TYPE "crm"."lead_source" ADD VALUE 'whatsapp' BEFORE 'website';--> statement-breakpoint
ALTER TYPE "crm"."workflow_trigger" ADD VALUE 'outreach_stale';--> statement-breakpoint
CREATE TABLE "crm"."import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"imported_by_user_id" uuid NOT NULL,
	"source" "crm"."lead_source" DEFAULT 'other' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicates_skipped" integer DEFAULT 0 NOT NULL,
	"default_tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "crm"."lead_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"r2_key" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "crm"."lead_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" "crm"."outreach_channel" NOT NULL,
	"stage" "crm"."lead_channel_stage" DEFAULT 'not_started' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_followup_at" timestamp with time zone,
	"sequence" integer DEFAULT 1 NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD COLUMN "lead_number" text;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."lead_attachments" ADD CONSTRAINT "lead_attachments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."lead_channels" ADD CONSTRAINT "lead_channels_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_import_batches_name" ON "crm"."import_batches" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_import_batches_imported_by" ON "crm"."import_batches" USING btree ("imported_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_import_batches_created" ON "crm"."import_batches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_attachments_lead" ON "crm"."lead_attachments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_attachments_uploaded_by" ON "crm"."lead_attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_lead" ON "crm"."lead_channels" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_channel" ON "crm"."lead_channels" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_stage" ON "crm"."lead_channels" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_next_followup" ON "crm"."lead_channels" USING btree ("next_followup_at");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_sequence" ON "crm"."lead_channels" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "idx_lead_channels_owner" ON "crm"."lead_channels" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "crm"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_lead_number" ON "crm"."leads" USING btree ("lead_number");--> statement-breakpoint
CREATE INDEX "idx_leads_batch" ON "crm"."leads" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_lead" ON "crm"."tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_type" ON "crm"."tasks" USING btree ("type");--> statement-breakpoint
-- Backfill: leadNumber sequence + existing-lead numbering + lead_channels rows.
CREATE SEQUENCE IF NOT EXISTS "crm"."lead_number_seq" AS bigint START WITH 1 INCREMENT BY 1;--> statement-breakpoint
UPDATE "crm"."leads" SET "lead_number" = 'L-' || lpad(nextval('crm.lead_number_seq')::text, 5, '0') WHERE "lead_number" IS NULL;--> statement-breakpoint
INSERT INTO "crm"."lead_channels" ("lead_id", "channel", "stage", "attempt_count", "last_attempt_at", "sequence", "owner_id", "updated_at")
SELECT l."id", 'linkedin', 
  CASE l."outreach_status"
    WHEN 'approached' THEN 'message_sent'::"crm"."lead_channel_stage"
    WHEN 'connected' THEN 'in_conversation'::"crm"."lead_channel_stage"
    WHEN 'replied' THEN 'replied'::"crm"."lead_channel_stage"
    WHEN 'booked_call' THEN 'booked_call'::"crm"."lead_channel_stage"
    WHEN 'not_interested' THEN 'no_response'::"crm"."lead_channel_stage"
    WHEN 'bad_fit' THEN 'no_response'::"crm"."lead_channel_stage"
    ELSE 'not_started'::"crm"."lead_channel_stage"
  END,
  CASE WHEN l."outreach_status" NOT IN ('not_approached','') THEN 1 ELSE 0 END,
  l."approached_at",
  1, l."owner_id", now()
FROM "crm"."leads" l
WHERE l."linkedin_url" IS NOT NULL AND l."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "crm"."lead_channels" lc WHERE lc."lead_id" = l."id" AND lc."channel" = 'linkedin');--> statement-breakpoint
INSERT INTO "crm"."lead_channels" ("lead_id", "channel", "stage", "attempt_count", "last_attempt_at", "sequence", "owner_id", "updated_at")
SELECT l."id", 'email',
  CASE l."outreach_status"
    WHEN 'approached' THEN 'message_sent'::"crm"."lead_channel_stage"
    WHEN 'connected' THEN 'in_conversation'::"crm"."lead_channel_stage"
    WHEN 'replied' THEN 'replied'::"crm"."lead_channel_stage"
    WHEN 'booked_call' THEN 'booked_call'::"crm"."lead_channel_stage"
    WHEN 'not_interested' THEN 'no_response'::"crm"."lead_channel_stage"
    WHEN 'bad_fit' THEN 'no_response'::"crm"."lead_channel_stage"
    ELSE 'not_started'::"crm"."lead_channel_stage"
  END,
  0, NULL, 2, l."owner_id", now()
FROM "crm"."leads" l
WHERE l."email" NOT LIKE '%@placeholder.skarion' AND l."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "crm"."lead_channels" lc WHERE lc."lead_id" = l."id" AND lc."channel" = 'email');--> statement-breakpoint
INSERT INTO "crm"."lead_channels" ("lead_id", "channel", "stage", "attempt_count", "sequence", "owner_id", "updated_at")
SELECT l."id", 'phone', 'not_started'::"crm"."lead_channel_stage", 0, 3, l."owner_id", now()
FROM "crm"."leads" l
WHERE l."phone" IS NOT NULL AND l."phone" <> '' AND l."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "crm"."lead_channels" lc WHERE lc."lead_id" = l."id" AND lc."channel" = 'phone');--> statement-breakpoint
-- Seed default outreach_stale workflow rules.
INSERT INTO "crm"."workflow_rules" ("name", "trigger", "conditions", "actions", "enabled", "created_at", "updated_at") VALUES
('LinkedIn stale → escalate to email', 'outreach_stale', '{"channel":"linkedin","afterAttempts":2,"waitDays":7,"nextChannel":"email"}'::jsonb, '{"kind":"escalate_to_next_channel_task","taskTitle":"Email follow-up due for {{lead.first_name}} {{lead.last_name}} — LinkedIn stale after {{wait_days}}d","taskPriority":"medium"}'::jsonb, true, now(), now()),
('Email stale → escalate to facebook', 'outreach_stale', '{"channel":"email","afterAttempts":2,"waitDays":7,"nextChannel":"facebook"}'::jsonb, '{"kind":"escalate_to_next_channel_task","taskTitle":"Facebook follow-up due for {{lead.first_name}} {{lead.last_name}} — email stale after {{wait_days}}d","taskPriority":"medium"}'::jsonb, true, now(), now()),
('WhatsApp stale → escalate to phone', 'outreach_stale', '{"channel":"whatsapp","afterAttempts":2,"waitDays":7,"nextChannel":"phone"}'::jsonb, '{"kind":"escalate_to_next_channel_task","taskTitle":"Phone follow-up due for {{lead.first_name}} {{lead.last_name}} — WhatsApp stale after {{wait_days}}d","taskPriority":"medium"}'::jsonb, true, now(), now())
ON CONFLICT DO NOTHING;