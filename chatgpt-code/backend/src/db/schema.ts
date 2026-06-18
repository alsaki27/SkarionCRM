import { pgTable, pgEnum, uuid, varchar, integer, boolean, timestamp, text, date, jsonb, numeric, index, primaryKey } from 'drizzle-orm/pg-core';

/*
 * Database schema definitions for the Skarion CRM.
 *
 * These tables mirror the SQL schema in the planning document and are
 * declared using Drizzle's type‑safe schema builder.  By defining the
 * schema in TypeScript we gain compile‑time safety when building queries
 * and migrations.
 */

// ─────────────────────────────────────────────────────────────
// ENUMERATIONS
// ─────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', [
  'admin', 'director', 'manager', 'team_lead', 'outreach_agent', 'onboarding_manager', 'viewer',
]);

export const leadStatusEnum = pgEnum('lead_status', [
  'new', 'enriched', 'contacted', 'responded', 'call_booked', 'interested',
  'contract_sent', 'contract_signed', 'payment_confirmed', 'onboarding',
  'active', 'completed', 'placed', 'cold', 'disqualified',
]);

export const leadTemperatureEnum = pgEnum('lead_temperature', ['cold', 'warm', 'hot']);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

export const messageSentimentEnum = pgEnum('message_sentiment', [
  'interested', 'neutral', 'curious', 'rejected', 'ghosted', 'angry',
]);

export const sequenceStatusEnum = pgEnum('sequence_status', [
  'pending', 'sent', 'responded', 'cancelled', 'failed',
]);

export const callOutcomeEnum = pgEnum('call_outcome', [
  'scheduled', 'completed_interested', 'completed_not_interested', 'completed_later', 'no_show', 'cancelled', 'rescheduled',
]);

export const contractStatusEnum = pgEnum('contract_status', [
  'not_sent', 'sent', 'signed', 'expired',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'deposit_paid', 'fully_paid', 'refunded', 'waived',
]);

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done', 'cancelled']);

// ─────────────────────────────────────────────────────────────
// TABLES
// ─────────────────────────────────────────────────────────────

// Users and Teams
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  leadCapacity: integer('lead_capacity').default(200),
  specializations: text('specializations').array().default('{}'),
  roundRobinIndex: integer('round_robin_index').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull(),
  teamId: uuid('team_id'),
  maxLeads: integer('max_leads').default(50),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    roleIdx: index('idx_users_role').on(table.role),
    teamIdx: index('idx_users_team').on(table.teamId),
    activeIdx: index('idx_users_active').on(table.isActive).where(table.isActive.eq(true)),
  };
});

// Leads
export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  location: varchar('location', { length: 255 }),
  timezone: varchar('timezone', { length: 50 }).default('America/New_York'),
  source: varchar('source', { length: 100 }).notNull(),
  campaignTag: varchar('campaign_tag', { length: 255 }),
  status: leadStatusEnum('status').default('new'),
  temperature: leadTemperatureEnum('temperature').default('cold'),
  score: integer('score').default(0),
  ownerId: uuid('owner_id'),
  backupOwnerId: uuid('backup_owner_id'),
  isDuplicate: boolean('is_duplicate').default(false),
  masterLeadId: uuid('master_lead_id'),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_leads_status').on(table.status),
    ownerIdx: index('idx_leads_owner').on(table.ownerId),
    temperatureIdx: index('idx_leads_temperature').on(table.temperature),
    sourceIdx: index('idx_leads_source').on(table.source),
    scoreIdx: index('idx_leads_score').on(table.score),
    nextFollowUpIdx: index('idx_leads_next_followup').on(table.nextFollowUpAt).where(table.nextFollowUpAt.isNotNull()),
    duplicateIdx: index('idx_leads_duplicate').on(table.isDuplicate).where(table.isDuplicate.eq(false)),
    slaIdx: index('idx_leads_sla').on(table.slaDeadline).where(table.slaDeadline.isNotNull()),
  };
});

// Lead Profiles
export const leadProfiles = pgTable('lead_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull().unique(),
  education: varchar('education', { length: 255 }),
  degree: varchar('degree', { length: 255 }),
  university: varchar('university', { length: 255 }),
  gradYear: integer('grad_year'),
  visaStatus: varchar('visa_status', { length: 100 }),
  skills: text('skills').array().default('{}'),
  hasAutocad: boolean('has_autocad').default(false),
  hasGis: boolean('has_gis').default(false),
  hasOspExperience: boolean('has_osp_experience').default(false),
  jobReadiness: integer('job_readiness').default(0),
  engineeringMajor: varchar('engineering_major', { length: 100 }),
  isOpenToRelocate: boolean('is_open_to_relocate'),
  heardAboutOsp: boolean('heard_about_osp').default(false),
  linkedinUrl: text('linkedin_url'),
  portfolioUrl: text('portfolio_url'),
  rawProfileData: jsonb('raw_profile_data').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    skillsIdx: index('idx_profile_skills').on(table.skills),
    majorIdx: index('idx_profile_major').on(table.engineeringMajor),
  };
});

// Contacts
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  handle: varchar('handle', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    leadIdx: index('idx_contacts_lead').on(table.leadId),
    handleIdx: index('idx_contacts_handle').on(table.handle),
  };
});

// Lead Sources
export const leadSources = pgTable('lead_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  channel: varchar('channel', { length: 100 }),
  costPerLead: numeric('cost_per_lead', { precision: 10, scale: 2 }).default('0'),
  totalLeads: integer('total_leads').default(0),
  convertedLeads: integer('converted_leads').default(0),
  // conversionRate is a computed column in SQL; Drizzle doesn't support computed columns directly.
  metadata: jsonb('metadata').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    activeIdx: index('idx_sources_active').on(table.isActive).where(table.isActive.eq(true)),
  };
});

// Conversations
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  direction: messageDirectionEnum('direction').notNull(),
  content: text('content').notNull(),
  sentiment: messageSentimentEnum('sentiment'),
  summary: text('summary'),
  aiGenerated: boolean('ai_generated').default(false),
  templateId: uuid('template_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    leadIdx: index('idx_conversations_lead').on(table.leadId),
    createdIdx: index('idx_conversations_created').on(table.createdAt),
    sentimentIdx: index('idx_conversations_sentiment').on(table.sentiment),
  };
});

// Message Templates
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  variables: text('variables').array().default('{}'),
  createdBy: uuid('created_by'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Follow‑up Sequences
export const followUpSequences = pgTable('follow_up_sequences', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  status: sequenceStatusEnum('status').default('pending'),
  templateId: uuid('template_id'),
  content: text('content'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    pendingIdx: index('idx_sequences_pending').on(table.status, table.scheduledAt).where(table.status.eq('pending')),
    leadIdx: index('idx_sequences_lead').on(table.leadId),
  };
});

// Pipeline Stages
export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(),
  requiredFields: text('required_fields').array().default('{}'),
  slaHours: integer('sla_hours').default(48),
  automations: jsonb('automations').default('{}'),
  color: varchar('color', { length: 20 }).default('#6366f1'),
  isActive: boolean('is_active').default(true),
});

// Pipeline Transitions
export const pipelineTransitions = pgTable('pipeline_transitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull(),
  fromStageId: uuid('from_stage_id'),
  toStageId: uuid('to_stage_id').notNull(),
  triggeredBy: uuid('triggered_by'),
  triggerType: varchar('trigger_type', { length: 100 }).default('manual'),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    leadIdx: index('idx_transitions_lead').on(table.leadId),
    createdIdx: index('idx_transitions_created').on(table.createdAt),
  };
});

// Call Bookings
export const callBookings = pgTable('call_bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').default(30),
  meetingLink: varchar('meeting_link', { length: 500 }),
  outcome: callOutcomeEnum('outcome').default('scheduled'),
  consultationNotes: text('consultation_notes'),
  answers: jsonb('answers').default('{}'),
  interestLevel: integer('interest_level'),
  objections: text('objections').array().default('{}'),
  nextSteps: text('next_steps'),
  recordedUrl: text('recorded_url'),
  bookedBy: uuid('booked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    scheduledIdx: index('idx_bookings_scheduled').on(table.scheduledAt),
    outcomeIdx: index('idx_bookings_outcome').on(table.outcome),
    leadIdx: index('idx_bookings_lead').on(table.leadId),
  };
});

// Programs
export const programs = pgTable('programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  durationWeeks: integer('duration_weeks').notNull(),
  prerequisites: text('prerequisites').array().default('{}'),
  modules: jsonb('modules').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Enrollments
export const enrollments = pgTable('enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id').notNull().unique(),
  programId: uuid('program_id').notNull(),
  contractStatus: contractStatusEnum('contract_status').default('not_sent'),
  contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
  rabbitSignDocId: varchar('rabbit_sign_doc_id', { length: 255 }),
  paymentStatus: paymentStatusEnum('payment_status').default('pending'),
  depositAmount: numeric('deposit_amount', { precision: 10, scale: 2 }).default('500.00'),
  finalFeeAmount: numeric('final_fee_amount', { precision: 10, scale: 2 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  expectedCompletionAt: timestamp('expected_completion_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('pending'),
  groupChatId: varchar('group_chat_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_enrollments_status').on(table.status),
    programIdx: index('idx_enrollments_program').on(table.programId),
  };
});

// Student Progress
export const studentProgress = pgTable('student_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id').notNull(),
  moduleId: varchar('module_id', { length: 100 }).notNull(),
  moduleName: varchar('module_name', { length: 255 }),
  completionPct: integer('completion_pct').default(0),
  mentorId: uuid('mentor_id'),
  attendance: jsonb('attendance').default('[]'),
  assignments: jsonb('assignments').default('[]'),
  quizScores: jsonb('quiz_scores').default('[]'),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    enrollmentIdx: index('idx_progress_enrollment').on(table.enrollmentId),
    moduleIdx: index('idx_progress_module').on(table.moduleId),
  };
});

// Placements
export const placements = pgTable('placements', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  salary: numeric('salary', { precision: 10, scale: 2 }),
  salaryType: varchar('salary_type', { length: 50 }).default('annual'),
  startDate: date('start_date'),
  offerReceivedAt: timestamp('offer_received_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('offer_received'),
  recruiterName: varchar('recruiter_name', { length: 255 }),
  jobSource: varchar('job_source', { length: 100 }),
  placementFee: numeric('placement_fee', { precision: 10, scale: 2 }),
  feePaid: boolean('fee_paid').default(false),
  feePaidAt: timestamp('fee_paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    enrollmentIdx: index('idx_placements_enrollment').on(table.enrollmentId),
    statusIdx: index('idx_placements_status').on(table.status),
  };
});

// Tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  assigneeId: uuid('assignee_id'),
  leadId: uuid('lead_id'),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  status: taskStatusEnum('status').default('todo'),
  priority: taskPriorityEnum('priority').default('medium'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by'),
  teamsMessageId: varchar('teams_message_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    assigneeIdx: index('idx_tasks_assignee').on(table.assigneeId, table.status),
    dueIdx: index('idx_tasks_due').on(table.dueAt),
    leadIdx: index('idx_tasks_lead').on(table.leadId),
  };
});

// Activity Log
export const activityLog = pgTable('activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id'),
  actorId: uuid('actor_id'),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details').default('{}'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    leadIdx: index('idx_activity_lead').on(table.leadId, table.createdAt),
    actorIdx: index('idx_activity_actor').on(table.actorId, table.createdAt),
    entityIdx: index('idx_activity_entity').on(table.entityType, table.entityId),
    createdIdx: index('idx_activity_created').on(table.createdAt),
  };
});

// Analytics Snapshots
export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull(),
  metricName: varchar('metric_name', { length: 255 }).notNull(),
  dimension: varchar('dimension', { length: 255 }),
  value: numeric('value', { precision: 15, scale: 4 }).notNull(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    dateIdx: index('idx_analytics_date').on(table.date),
    metricIdx: index('idx_analytics_metric').on(table.metricName, table.date),
  };
});

// Teams Sync Log
export const teamsSyncLog = pgTable('teams_sync_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamsMessageId: varchar('teams_message_id', { length: 255 }).notNull(),
  teamsConversationId: varchar('teams_conversation_id', { length: 255 }),
  leadId: uuid('lead_id'),
  processedContent: text('processed_content'),
  actionTaken: varchar('action_taken', { length: 255 }),
  confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }),
  aiModelUsed: varchar('ai_model_used', { length: 50 }),
  rawPayload: jsonb('raw_payload').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    messageIdx: index('idx_teams_message').on(table.teamsMessageId),
    leadIdx: index('idx_teams_lead').on(table.leadId),
    createdIdx: index('idx_teams_created').on(table.createdAt),
  };
});