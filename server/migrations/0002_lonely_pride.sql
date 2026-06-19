CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'half_day', 'on_leave', 'remote', 'holiday', 'weekend');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('vacation', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'jury_duty', 'unpaid', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'completed', 'on_hold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shift_swap_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."time_entry_type" AS ENUM('clock_in', 'clock_out', 'lunch_start', 'lunch_end', 'break_start', 'break_end', 'project_switch');--> statement-breakpoint
CREATE TYPE "public"."timesheet_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" DEFAULT 'present',
	"clock_in" timestamp with time zone,
	"clock_out" timestamp with time zone,
	"total_hours" numeric(5, 2) DEFAULT '0',
	"break_hours" numeric(5, 2) DEFAULT '0',
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"late_minutes" integer DEFAULT 0,
	"early_departure_minutes" integer DEFAULT 0,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holiday_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"type" varchar(50) DEFAULT 'public',
	"country" varchar(100),
	"state" varchar(100),
	"is_paid" boolean DEFAULT true,
	"is_recurring" boolean DEFAULT true,
	"description" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"total_entitled" numeric(5, 2) DEFAULT '0',
	"accrued" numeric(5, 2) DEFAULT '0',
	"used" numeric(5, 2) DEFAULT '0',
	"pending" numeric(5, 2) DEFAULT '0',
	"remaining" numeric(5, 2) DEFAULT '0',
	"carry_over" numeric(5, 2) DEFAULT '0',
	"year" integer DEFAULT 2026 NOT NULL,
	"last_accrued_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_requested" numeric(5, 2) DEFAULT '1' NOT NULL,
	"is_half_day" boolean DEFAULT false,
	"half_day_type" varchar(20),
	"status" "leave_status" DEFAULT 'pending',
	"reason" text,
	"manager_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"sick_note_path" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "leave_type" NOT NULL,
	"description" text,
	"is_paid" boolean DEFAULT true,
	"requires_approval" boolean DEFAULT true,
	"max_days_per_year" numeric(5, 2) DEFAULT '10',
	"accrual_rate" numeric(5, 2) DEFAULT '0',
	"accrual_period" varchar(50) DEFAULT 'monthly',
	"carry_over_limit" numeric(5, 2) DEFAULT '5',
	"use_it_or_lose_it" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"estimated_hours" numeric(10, 2),
	"status" varchar(50) DEFAULT 'active',
	"assigned_to" uuid,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"date" date NOT NULL,
	"hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_billable" boolean DEFAULT true,
	"hourly_rate" numeric(10, 2),
	"total_amount" numeric(10, 2) DEFAULT '0',
	"description" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"client_id" uuid,
	"manager_id" uuid,
	"budget_hours" numeric(10, 2),
	"hourly_rate" numeric(10, 2),
	"status" "project_status" DEFAULT 'active',
	"is_billable" boolean DEFAULT true,
	"start_date" date,
	"end_date" date,
	"color" varchar(7) DEFAULT '#3b82f6',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_swaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"requester_schedule_id" uuid NOT NULL,
	"recipient_schedule_id" uuid NOT NULL,
	"swap_date" date NOT NULL,
	"status" "shift_swap_status" DEFAULT 'pending',
	"reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"entry_type" time_entry_type NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(50) DEFAULT 'web',
	"project_id" uuid,
	"task_id" uuid,
	"activity_score" integer DEFAULT 0,
	"screenshot_id" uuid,
	"notes" text,
	"ip_address" "inet",
	"geo_location" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"timesheet_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"description" text,
	"hours" numeric(5, 2) DEFAULT '0',
	"is_billable" boolean DEFAULT true,
	"hourly_rate" numeric(10, 2),
	"total_amount" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"status" timesheet_status DEFAULT 'draft',
	"total_hours" numeric(5, 2) DEFAULT '0',
	"regular_hours" numeric(5, 2) DEFAULT '0',
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"break_hours" numeric(5, 2) DEFAULT '0',
	"billable_hours" numeric(5, 2) DEFAULT '0',
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"shift_start" time NOT NULL,
	"shift_end" time NOT NULL,
	"break_duration_minutes" integer DEFAULT 60,
	"working_days" text[] DEFAULT '{}',
	"overtime_threshold_daily" numeric(5, 2) DEFAULT '8.00',
	"overtime_threshold_weekly" numeric(5, 2) DEFAULT '40.00',
	"grace_period_minutes" integer DEFAULT 5,
	"rounding_interval_minutes" integer DEFAULT 15,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_calendars" ADD CONSTRAINT "holiday_calendars_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_project_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_employees_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_contacts_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requester_id_employees_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_recipient_id_employees_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requester_schedule_id_work_schedules_id_fk" FOREIGN KEY ("requester_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_recipient_schedule_id_work_schedules_id_fk" FOREIGN KEY ("recipient_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "public"."timesheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_attendance_emp_date" ON "attendance_records" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "idx_attendance_org" ON "attendance_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_date" ON "attendance_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_attendance_status" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_holiday_org" ON "holiday_calendars" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_holiday_date" ON "holiday_calendars" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_holiday_country" ON "holiday_calendars" USING btree ("country");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_balance_emp_type_year" ON "leave_balances" USING btree ("employee_id","leave_type_id","year");--> statement-breakpoint
CREATE INDEX "idx_balance_org" ON "leave_balances" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_balance_employee" ON "leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_req_org" ON "leave_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_leave_req_employee" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_req_status" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leave_req_dates" ON "leave_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_leave_req_type" ON "leave_requests" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "idx_leave_req_manager" ON "leave_requests" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_leave_type_org" ON "leave_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_leave_type_active" ON "leave_types" USING btree ("is_active") WHERE "leave_types"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_proj_task_project" ON "project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_proj_task_org" ON "project_tasks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_proj_task_parent" ON "project_tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "idx_proj_task_assigned" ON "project_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_proj_time_org" ON "project_time_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_proj_time_employee" ON "project_time_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_proj_time_project" ON "project_time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_proj_time_date" ON "project_time_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_proj_time_task" ON "project_time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_project_org" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_project_client" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_project_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_project_manager" ON "projects" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_shift_assign_org" ON "shift_assignments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_shift_assign_employee" ON "shift_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_shift_assign_schedule" ON "shift_assignments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "idx_swap_org" ON "shift_swaps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_swap_requester" ON "shift_swaps" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "idx_swap_recipient" ON "shift_swaps" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_swap_status" ON "shift_swaps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_swap_date" ON "shift_swaps" USING btree ("swap_date");--> statement-breakpoint
CREATE INDEX "idx_time_entry_org" ON "time_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_employee" ON "time_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_date" ON "time_entries" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_time_entry_type" ON "time_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "idx_time_entry_project" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ts_entry_timesheet" ON "timesheet_entries" USING btree ("timesheet_id");--> statement-breakpoint
CREATE INDEX "idx_ts_entry_org" ON "timesheet_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ts_entry_employee" ON "timesheet_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_ts_entry_date" ON "timesheet_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ts_entry_project" ON "timesheet_entries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_timesheet_emp_week" ON "timesheets" USING btree ("employee_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_timesheet_org" ON "timesheets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_timesheet_status" ON "timesheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_timesheet_employee" ON "timesheets" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_work_schedule_org" ON "work_schedules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_work_schedule_active" ON "work_schedules" USING btree ("is_active") WHERE "work_schedules"."is_active" = true;