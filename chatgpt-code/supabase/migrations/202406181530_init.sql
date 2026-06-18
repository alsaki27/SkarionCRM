-- ===============================================================
-- SKARION CRM — COMPLETE DATABASE SCHEMA
-- This migration file can be applied to a Supabase PostgreSQL
-- instance via the Supabase CLI.  It recreates the schema exactly
-- as defined in the planning blueprint and seeds initial data such
-- as pipeline stages, programs and lead sources.
-- ===============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USER & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'director', 'manager', 'team_lead', 'outreach_agent', 'onboarding_manager', 'viewer')),
    team_id UUID,
    max_leads INTEGER DEFAULT 50 CHECK (max_leads > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    lead_capacity INTEGER DEFAULT 200,
    specializations TEXT[] DEFAULT '{}',
    round_robin_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS fk_users_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================
-- 2. LEAD CAPTURE & MANAGEMENT
-- ============================================

CREATE TYPE IF NOT EXISTS lead_status AS ENUM (
    'new', 'enriched', 'contacted', 'responded', 'call_booked', 
    'interested', 'contract_sent', 'contract_signed', 'payment_confirmed',
    'onboarding', 'active', 'completed', 'placed', 'cold', 'disqualified'
);

CREATE TYPE IF NOT EXISTS lead_temperature AS ENUM ('cold', 'warm', 'hot');

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    source VARCHAR(100) NOT NULL,
    campaign_tag VARCHAR(255),
    status lead_status DEFAULT 'new',
    temperature lead_temperature DEFAULT 'cold',
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    owner_id UUID,
    backup_owner_id UUID,
    is_duplicate BOOLEAN DEFAULT false,
    master_lead_id UUID,
    sla_deadline TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    next_follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_duplicate ON leads(is_duplicate) WHERE is_duplicate = false;
CREATE INDEX IF NOT EXISTS idx_leads_sla ON leads(sla_deadline) WHERE sla_deadline IS NOT NULL;

ALTER TABLE leads ADD CONSTRAINT IF NOT EXISTS fk_leads_owner 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT IF NOT EXISTS fk_leads_backup_owner 
    FOREIGN KEY (backup_owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT IF NOT EXISTS fk_leads_master 
    FOREIGN KEY (master_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Lead Profile
CREATE TABLE IF NOT EXISTS lead_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE,
    education VARCHAR(255),
    degree VARCHAR(255),
    university VARCHAR(255),
    grad_year INTEGER,
    visa_status VARCHAR(100),
    skills TEXT[] DEFAULT '{}',
    has_autocad BOOLEAN DEFAULT false,
    has_gis BOOLEAN DEFAULT false,
    has_osp_experience BOOLEAN DEFAULT false,
    job_readiness INTEGER DEFAULT 0 CHECK (job_readiness >= 0 AND job_readiness <= 100),
    engineering_major VARCHAR(100),
    is_open_to_relocate BOOLEAN,
    heard_about_osp BOOLEAN DEFAULT false,
    linkedin_url TEXT,
    portfolio_url TEXT,
    raw_profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_profiles ADD CONSTRAINT IF NOT EXISTS fk_profile_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profile_skills ON lead_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_profile_major ON lead_profiles(engineering_major);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'phone', 'whatsapp', 'linkedin', 'facebook', 'reddit', 'teams')),
    handle VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ADD CONSTRAINT IF NOT EXISTS fk_contacts_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_handle ON contacts(handle);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_primary ON contacts(lead_id, channel) WHERE is_primary = true;

-- ============================================
-- 3. LEAD SOURCES & CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    channel VARCHAR(100),
    cost_per_lead DECIMAL(10,2) DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    converted_leads INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_active ON lead_sources(is_active) WHERE is_active = true;

-- ============================================
-- 4. COMMUNICATION TRACKING
-- ============================================

CREATE TYPE IF NOT EXISTS message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE IF NOT EXISTS message_sentiment AS ENUM ('interested', 'neutral', 'curious', 'rejected', 'ghosted', 'angry');

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'phone', 'whatsapp', 'linkedin', 'facebook', 'reddit', 'teams', 'call')),
    direction message_direction NOT NULL,
    content TEXT NOT NULL,
    sentiment message_sentiment,
    summary TEXT,
    ai_generated BOOLEAN DEFAULT false,
    template_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ADD CONSTRAINT IF NOT EXISTS fk_conversations_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_sentiment ON conversations(sentiment);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    created_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ADD CONSTRAINT IF NOT EXISTS fk_templates_creator 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Follow‑up Sequences
CREATE TYPE IF NOT EXISTS sequence_status AS ENUM ('pending', 'sent', 'responded', 'cancelled', 'failed');

CREATE TABLE IF NOT EXISTS follow_up_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    step_number INTEGER NOT NULL CHECK (step_number > 0),
    channel VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status sequence_status DEFAULT 'pending',
    template_id UUID,
    content TEXT,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE follow_up_sequences ADD CONSTRAINT IF NOT EXISTS fk_sequences_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE follow_up_sequences ADD CONSTRAINT IF NOT EXISTS fk_sequences_template 
    FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sequences_pending ON follow_up_sequences(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sequences_lead ON follow_up_sequences(lead_id);

-- ============================================
-- 5. PIPELINE STAGES & TRANSITIONS
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL CHECK (category IN ('lead', 'pre_onboarding', 'onboarding', 'active', 'completion')),
    required_fields TEXT[] DEFAULT '{}',
    sla_hours INTEGER DEFAULT 48,
    automations JSONB DEFAULT '{}',
    color VARCHAR(20) DEFAULT '#6366f1',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS pipeline_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    from_stage_id UUID,
    to_stage_id UUID NOT NULL,
    triggered_by UUID,
    trigger_type VARCHAR(100) DEFAULT 'manual',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_transitions ADD CONSTRAINT IF NOT EXISTS fk_transitions_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE pipeline_transitions ADD CONSTRAINT IF NOT EXISTS fk_transitions_from 
    FOREIGN KEY (from_stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE pipeline_transitions ADD CONSTRAINT IF NOT EXISTS fk_transitions_to 
    FOREIGN KEY (to_stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT;
ALTER TABLE pipeline_transitions ADD CONSTRAINT IF NOT EXISTS fk_transitions_triggered_by 
    FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transitions_lead ON pipeline_transitions(lead_id);
CREATE INDEX IF NOT EXISTS idx_transitions_created ON pipeline_transitions(created_at DESC);

-- ============================================
-- 6. CALL BOOKINGS
-- ============================================

CREATE TYPE IF NOT EXISTS call_outcome AS ENUM ('scheduled', 'completed_interested', 'completed_not_interested', 'completed_later', 'no_show', 'cancelled', 'rescheduled');

CREATE TABLE IF NOT EXISTS call_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_min INTEGER DEFAULT 30,
    meeting_link VARCHAR(500),
    outcome call_outcome DEFAULT 'scheduled',
    consultation_notes TEXT,
    answers JSONB DEFAULT '{}',
    interest_level INTEGER CHECK (interest_level >= 1 AND interest_level <= 10),
    objections TEXT[] DEFAULT '{}',
    next_steps TEXT,
    recorded_url TEXT,
    booked_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE call_bookings ADD CONSTRAINT IF NOT EXISTS fk_bookings_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE call_bookings ADD CONSTRAINT IF NOT EXISTS fk_bookings_booker 
    FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON call_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_outcome ON call_bookings(outcome);
CREATE INDEX IF NOT EXISTS idx_bookings_lead ON call_bookings(lead_id);

-- ============================================
-- 7. PROGRAMS & ENROLLMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_weeks INTEGER NOT NULL,
    prerequisites TEXT[] DEFAULT '{}',
    modules JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE IF NOT EXISTS contract_status AS ENUM ('not_sent', 'sent', 'signed', 'expired');
CREATE TYPE IF NOT EXISTS payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'waived');

CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE,
    program_id UUID NOT NULL,
    contract_status contract_status DEFAULT 'not_sent',
    contract_signed_at TIMESTAMPTZ,
    rabbit_sign_doc_id VARCHAR(255),
    payment_status payment_status DEFAULT 'pending',
    deposit_amount DECIMAL(10,2) DEFAULT 500.00,
    final_fee_amount DECIMAL(10,2),
    started_at TIMESTAMPTZ,
    expected_completion_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending',
    group_chat_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE enrollments ADD CONSTRAINT IF NOT EXISTS fk_enrollments_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT IF NOT EXISTS fk_enrollments_program 
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON enrollments(program_id);

-- ============================================
-- 8. STUDENT PROGRESS & MENTORSHIP
-- ============================================

CREATE TABLE IF NOT EXISTS student_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL,
    module_id VARCHAR(100) NOT NULL,
    module_name VARCHAR(255),
    completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
    mentor_id UUID,
    attendance JSONB DEFAULT '[]',
    assignments JSONB DEFAULT '[]',
    quiz_scores JSONB DEFAULT '[]',
    last_accessed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE student_progress ADD CONSTRAINT IF NOT EXISTS fk_progress_enrollment 
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;
ALTER TABLE student_progress ADD CONSTRAINT IF NOT EXISTS fk_progress_mentor 
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_progress_enrollment ON student_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_progress_module ON student_progress(module_id);

-- ============================================
-- 9. PLACEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS placements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    salary DECIMAL(10,2),
    salary_type VARCHAR(50) DEFAULT 'annual',
    start_date DATE,
    offer_received_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'offer_received',
    recruiter_name VARCHAR(255),
    job_source VARCHAR(100),
    placement_fee DECIMAL(10,2),
    fee_paid BOOLEAN DEFAULT false,
    fee_paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE placements ADD CONSTRAINT IF NOT EXISTS fk_placements_enrollment 
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_placements_enrollment ON placements(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_placements_status ON placements(status);

-- ============================================
-- 10. TASKS & ACTIVITY LOG
-- ============================================

CREATE TYPE IF NOT EXISTS task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE IF NOT EXISTS task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignee_id UUID,
    lead_id UUID,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_at TIMESTAMPTZ,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    teams_message_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD CONSTRAINT IF NOT EXISTS fk_tasks_assignee 
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT IF NOT EXISTS fk_tasks_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT IF NOT EXISTS fk_tasks_completed_by 
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID,
    actor_id UUID,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ADD CONSTRAINT IF NOT EXISTS fk_activity_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT IF NOT EXISTS fk_activity_actor 
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

-- ============================================
-- 11. ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    dimension VARCHAR(255),
    value DECIMAL(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_analytics_metric ON analytics_snapshots(metric_name, date);

-- ============================================
-- 12. TEAMS INTEGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS teams_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teams_message_id VARCHAR(255) NOT NULL,
    teams_conversation_id VARCHAR(255),
    lead_id UUID,
    processed_content TEXT,
    action_taken VARCHAR(255),
    confidence_score DECIMAL(3,2),
    ai_model_used VARCHAR(50),
    raw_payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams_sync_log ADD CONSTRAINT IF NOT EXISTS fk_teams_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_message ON teams_sync_log(teams_message_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams_sync_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams_sync_log(created_at DESC);

-- ============================================
-- INITIAL SEED DATA
-- ============================================

-- Insert Pipeline Stages
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('New Lead', 1, 'lead', 24, '#94a3b8', '{"auto_assign": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Enriched', 2, 'lead', 48, '#60a5fa', '{"auto_score": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Contacted', 3, 'lead', 72, '#f59e0b', '{"start_followup": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Responded', 4, 'lead', 48, '#f97316', '{}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Call Booked', 5, 'lead', 24, '#8b5cf6', '{"create_task": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Interested', 6, 'pre_onboarding', 24, '#10b981', '{"send_contract": false}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Contract Sent', 7, 'pre_onboarding', 72, '#06b6d4', '{}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Contract Signed', 8, 'pre_onboarding', 24, '#14b8a6', '{"start_onboarding": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Payment Confirmed', 9, 'onboarding', 24, '#22c55e', '{}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Onboarding', 10, 'onboarding', 48, '#84cc16', '{"create_group_chat": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Active Student', 11, 'active', 168, '#eab308', '{"track_progress": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Course Completed', 12, 'completion', 72, '#f59e0b', '{"start_placement": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Job Placed', 13, 'completion', 168, '#10b981', '{"calculate_fee": true}') ON CONFLICT (name) DO NOTHING;
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('Alumni', 14, 'completion', NULL, '#6366f1', '{"request_testimonial": true}') ON CONFLICT (name) DO NOTHING;

-- Insert Programs
INSERT INTO programs (name, description, duration_weeks, prerequisites, modules, is_active) VALUES
('Introduction to AutoCAD', 'Learn AutoCAD from scratch for OSP engineering drawings', 2, '{}', '[{"id": "ac1", "name": "Interface & Basic Commands", "order": 1}, {"id": "ac2", "name": "2D Drafting Fundamentals", "order": 2}, {"id": "ac3", "name": "Layers, Dimensions & Annotations", "order": 3}]', true) ON CONFLICT (name) DO NOTHING;
INSERT INTO programs (name, description, duration_weeks, prerequisites, modules, is_active) VALUES
('Outside Plant Engineering', 'Complete OSP design engineering course for telecom infrastructure', 4, '{"Introduction to AutoCAD"}', '[{"id": "osp1", "name": "OSP Fundamentals", "order": 1}, {"id": "osp2", "name": "Fiber Network Design", "order": 2}, {"id": "osp3", "name": "Underground & Aerial Design", "order": 3}, {"id": "osp4", "name": "GIS & Mapping Tools", "order": 4}, {"id": "osp5", "name": "Permitting & Compliance", "order": 5}]', true) ON CONFLICT (name) DO NOTHING;
INSERT INTO programs (name, description, duration_weeks, prerequisites, modules, is_active) VALUES
('Interview Preparation', 'Mock interviews, common questions, and interview etiquette', 1, '{}', '[{"id": "int1", "name": "Interview Etiquette", "order": 1}, {"id": "int2", "name": "Common OSP Interview Questions", "order": 2}, {"id": "int3", "name": "Mock Interview Sessions", "order": 3}]', true) ON CONFLICT (name) DO NOTHING;

-- Insert Lead Sources
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Apollo AI Scraper', 'scraper', 'apollo', 0.05, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('LinkedIn Recruiter Lite', 'scraper', 'linkedin', 0.10, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('LinkedIn Sales Navigator', 'scraper', 'linkedin', 0.08, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('LinkedIn Organic Posts', 'social_media', 'linkedin', 0, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Facebook DM Outreach', 'social_media', 'facebook', 0, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Reddit Outreach', 'social_media', 'reddit', 0, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Referral Program', 'referral', 'referral', 0, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Website Contact Form', 'manual', 'website', 0, true) ON CONFLICT (name) DO NOTHING;
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Manual Entry', 'manual', 'manual', 0, true) ON CONFLICT (name) DO NOTHING;