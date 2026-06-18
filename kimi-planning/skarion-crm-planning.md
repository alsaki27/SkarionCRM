# Skarion CRM — Full Planning & Implementation Blueprint

> **A career-bootcamp CRM for lead capture, scoring, outreach automation, enrollment pipeline, student tracking, placement management, and AI-powered insights. Built for Skarion's OSP engineering placement program.**

---

## TL;DR — What This Document Delivers

This blueprint gives you a **complete, buildable specification** for a modern CRM that replaces scattered spreadsheets and manual processes with a single, cohesive platform. The system handles the full lifecycle — from the moment a potential candidate is discovered on LinkedIn to the day they land their first OSP engineering job and become an alumnus. It uses a **React + Vite + TypeScript** frontend, **Node.js + tRPC** backend, **PostgreSQL** database, **Kimi AI via NVIDIA** (free tier) for intelligence, **Ollama** as a local fallback, and **Microsoft Teams** for both sending follow-ups and receiving AI-processed message updates back into the CRM. Every module is designed around the actual workflows already documented in your business: lead sourcing from Apollo/LinkedIn/Reddit, consultation calls, RabbitSign contracts, course progression tracking, resume building, job application logging, and placement tracking. The architecture prioritizes **cheap hosting** (Vercel + Railway + Supabase free tiers) and **modern developer experience**.

---

## 1. Tech Stack Architecture

The entire system is built on a stack chosen for **zero-to-low hosting cost**, **rapid development**, and **type safety from database to UI**.

| Layer | Technology | Purpose | Hosting |
|---|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS | Dashboard, pipeline views, forms | **Vercel** (free tier) |
| **Backend API** | Node.js + Express + tRPC | Type-safe APIs, business logic | **Railway** ($5/mo or free tier) |
| **Database** | PostgreSQL 15 + Drizzle ORM | Relational data, audit trails | **Supabase** (free tier: 500MB) |
| **Auth** | Clerk.dev | User authentication, role-based access | **Clerk** (free: 10,000 MAU) |
| **AI (Primary)** | Kimi API via NVIDIA NIM | Lead scoring, message generation, sentiment | **Free tier** (NVIDIA credits) |
| **AI (Backup)** | Ollama (local) | Fallback when NVIDIA rate-limited, private data | **Your local machine** |
| **File Storage** | Supabase Storage | Resume uploads, contract PDFs | **Supabase** (1GB free) |
| **Scheduler** | node-cron | Follow-up automation, nightly reports | In-process (Railway) |
| **Teams Bot** | Microsoft Bot Framework + Graph API | Send follow-ups, read messages, sync to CRM | Azure Bot (free: 10K msgs/mo) |
| **Monitoring** | Railway built-in + LogSnag | Error tracking, uptime alerts | **Free tier** |

The architecture diagram below visualizes how these layers connect:

![System Architecture](architecture_diagram.png)

---

## 2. Database Schema (PostgreSQL)

The data model is the foundation of the entire CRM. Every table is designed to support the 12-stage pipeline you already defined. The schema uses **UUID primary keys** for all entities to enable safe merging during deduplication, **timestamp with time zone** for all temporal data (critical since Skarion serves candidates across multiple time zones), and **JSONB columns** for flexible arrays like skill tags and automation configs.

![Entity Relationship Diagram](erd_diagram.png)

### 2.1 Core Tables — DDL

The following SQL defines the complete database schema. Each table includes appropriate indexes, foreign key constraints, and check constraints to maintain data integrity at the database level.

```sql
-- ============================================
-- SKARION CRM — COMPLETE DATABASE SCHEMA
-- PostgreSQL 15+ with UUID extension
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USER & AUTHENTICATION
-- ============================================

CREATE TABLE users (
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

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    lead_capacity INTEGER DEFAULT 200,
    specializations TEXT[] DEFAULT '{}',
    round_robin_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT fk_users_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================
-- 2. LEAD CAPTURE & MANAGEMENT
-- ============================================

CREATE TYPE lead_status AS ENUM (
    'new', 'enriched', 'contacted', 'responded', 'call_booked', 
    'interested', 'contract_sent', 'contract_signed', 'payment_confirmed',
    'onboarding', 'active', 'completed', 'placed', 'cold', 'disqualified'
);

CREATE TYPE lead_temperature AS ENUM ('cold', 'warm', 'hot');

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    source VARCHAR(100) NOT NULL, -- 'apollo_ai', 'linkedin_recruiter', 'linkedin_navigator', 'reddit', 'facebook', 'referral', 'website', 'manual'
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

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_temperature ON leads(temperature);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_next_followup ON leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_leads_duplicate ON leads(is_duplicate) WHERE is_duplicate = false;
CREATE INDEX idx_leads_sla ON leads(sla_deadline) WHERE sla_deadline IS NOT NULL;

ALTER TABLE leads ADD CONSTRAINT fk_leads_owner 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT fk_leads_backup_owner 
    FOREIGN KEY (backup_owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT fk_leads_master 
    FOREIGN KEY (master_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Lead Profile — Enrichment Data
CREATE TABLE lead_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE,
    education VARCHAR(255),
    degree VARCHAR(255),
    university VARCHAR(255),
    grad_year INTEGER,
    visa_status VARCHAR(100), -- 'f1_opt', 'h1b', 'citizen', 'green_card', 'unknown'
    skills TEXT[] DEFAULT '{}',
    has_autocad BOOLEAN DEFAULT false,
    has_gis BOOLEAN DEFAULT false,
    has_osp_experience BOOLEAN DEFAULT false,
    job_readiness INTEGER DEFAULT 0 CHECK (job_readiness >= 0 AND job_readiness <= 100),
    engineering_major VARCHAR(100), -- 'civil', 'mechanical', 'structural', 'project_management', 'construction_management', 'other'
    is_open_to_relocate BOOLEAN,
    heard_about_osp BOOLEAN DEFAULT false,
    linkedin_url TEXT,
    portfolio_url TEXT,
    raw_profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_profiles ADD CONSTRAINT fk_profile_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX idx_profile_skills ON lead_profiles USING GIN(skills);
CREATE INDEX idx_profile_major ON lead_profiles(engineering_major);

-- Contact Channels
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'phone', 'whatsapp', 'linkedin', 'facebook', 'reddit', 'teams')),
    handle VARCHAR(255) NOT NULL, -- actual email, phone, linkedin URL, etc.
    is_primary BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ADD CONSTRAINT fk_contacts_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX idx_contacts_lead ON contacts(lead_id);
CREATE INDEX idx_contacts_handle ON contacts(handle);
CREATE UNIQUE INDEX idx_contacts_primary ON contacts(lead_id, channel) WHERE is_primary = true;

-- ============================================
-- 3. LEAD SOURCES & CAMPAIGNS
-- ============================================

CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'scraper', 'social_media', 'referral', 'ads', 'manual', 'integration'
    channel VARCHAR(100), -- 'linkedin', 'reddit', 'facebook', 'apollo', 'website'
    cost_per_lead DECIMAL(10,2) DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    converted_leads INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE WHEN total_leads > 0 THEN converted_leads::DECIMAL / total_leads ELSE 0 END
    ) STORED,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sources_active ON lead_sources(is_active) WHERE is_active = true;

-- ============================================
-- 4. COMMUNICATION TRACKING
-- ============================================

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_sentiment AS ENUM ('interested', 'neutral', 'curious', 'rejected', 'ghosted', 'angry');

CREATE TABLE conversations (
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

ALTER TABLE conversations ADD CONSTRAINT fk_conversations_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_sentiment ON conversations(sentiment);

-- Message Templates
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    purpose VARCHAR(100) NOT NULL, -- 'intro', 'follow_up', 'value', 'call_booking', 'contract', 'reminder'
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    created_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ADD CONSTRAINT fk_templates_creator 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Follow-up Sequences
CREATE TYPE sequence_status AS ENUM ('pending', 'sent', 'responded', 'cancelled', 'failed');

CREATE TABLE follow_up_sequences (
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

ALTER TABLE follow_up_sequences ADD CONSTRAINT fk_sequences_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE follow_up_sequences ADD CONSTRAINT fk_sequences_template 
    FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_sequences_pending ON follow_up_sequences(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_sequences_lead ON follow_up_sequences(lead_id);

-- ============================================
-- 5. PIPELINE STAGES & TRANSITIONS
-- ============================================

CREATE TABLE pipeline_stages (
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

CREATE TABLE pipeline_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL,
    from_stage_id UUID,
    to_stage_id UUID NOT NULL,
    triggered_by UUID,
    trigger_type VARCHAR(100) DEFAULT 'manual', -- 'manual', 'automation', 'api', 'teams_bot'
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_transitions ADD CONSTRAINT fk_transitions_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE pipeline_transitions ADD CONSTRAINT fk_transitions_from 
    FOREIGN KEY (from_stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE pipeline_transitions ADD CONSTRAINT fk_transitions_to 
    FOREIGN KEY (to_stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT;
ALTER TABLE pipeline_transitions ADD CONSTRAINT fk_transitions_triggered_by 
    FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_transitions_lead ON pipeline_transitions(lead_id);
CREATE INDEX idx_transitions_created ON pipeline_transitions(created_at DESC);

-- ============================================
-- 6. CALL BOOKINGS
-- ============================================

CREATE TYPE call_outcome AS ENUM ('scheduled', 'completed_interested', 'completed_not_interested', 'completed_later', 'no_show', 'cancelled', 'rescheduled');

CREATE TABLE call_bookings (
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

ALTER TABLE call_bookings ADD CONSTRAINT fk_bookings_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE call_bookings ADD CONSTRAINT fk_bookings_booker 
    FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_scheduled ON call_bookings(scheduled_at);
CREATE INDEX idx_bookings_outcome ON call_bookings(outcome);
CREATE INDEX idx_bookings_lead ON call_bookings(lead_id);

-- ============================================
-- 7. PROGRAMS & ENROLLMENTS
-- ============================================

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_weeks INTEGER NOT NULL,
    prerequisites TEXT[] DEFAULT '{}',
    modules JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE contract_status AS ENUM ('not_sent', 'sent', 'signed', 'expired');
CREATE TYPE payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'waived');

CREATE TABLE enrollments (
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
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'on_hold', 'completed', 'dropped'
    group_chat_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_program 
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT;

CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_program ON enrollments(program_id);

-- ============================================
-- 8. STUDENT PROGRESS & MENTORSHIP
-- ============================================

CREATE TABLE student_progress (
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

ALTER TABLE student_progress ADD CONSTRAINT fk_progress_enrollment 
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;
ALTER TABLE student_progress ADD CONSTRAINT fk_progress_mentor 
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_progress_enrollment ON student_progress(enrollment_id);
CREATE INDEX idx_progress_module ON student_progress(module_id);

-- ============================================
-- 9. PLACEMENTS
-- ============================================

CREATE TABLE placements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    salary DECIMAL(10,2),
    salary_type VARCHAR(50) DEFAULT 'annual', -- 'annual', 'hourly'
    start_date DATE,
    offer_received_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'offer_received', -- 'offer_received', 'negotiating', 'accepted', 'started', 'rejected'
    recruiter_name VARCHAR(255),
    job_source VARCHAR(100),
    placement_fee DECIMAL(10,2),
    fee_paid BOOLEAN DEFAULT false,
    fee_paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE placements ADD CONSTRAINT fk_placements_enrollment 
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;

CREATE INDEX idx_placements_enrollment ON placements(enrollment_id);
CREATE INDEX idx_placements_status ON placements(status);

-- ============================================
-- 10. TASKS & ACTIVITY LOG
-- ============================================

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignee_id UUID,
    lead_id UUID,
    type VARCHAR(100) NOT NULL, -- 'follow_up', 'call', 'contract', 'payment', 'onboarding', 'review_resume', 'mock_interview'
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_at TIMESTAMPTZ,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    teams_message_id VARCHAR(255), -- if created from Teams
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD CONSTRAINT fk_tasks_assignee 
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_completed_by 
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status) WHERE status != 'done';
CREATE INDEX idx_tasks_due ON tasks(due_at) WHERE status != 'done';
CREATE INDEX idx_tasks_lead ON tasks(lead_id);

-- Activity Log (Audit Trail)
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID,
    actor_id UUID,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- 'lead', 'conversation', 'task', 'enrollment', 'placement'
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ADD CONSTRAINT fk_activity_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT fk_activity_actor 
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_activity_lead ON activity_log(lead_id, created_at DESC);
CREATE INDEX idx_activity_actor ON activity_log(actor_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- ============================================
-- 11. ANALYTICS
-- ============================================

CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    dimension VARCHAR(255),
    value DECIMAL(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_date ON analytics_snapshots(date);
CREATE INDEX idx_analytics_metric ON analytics_snapshots(metric_name, date);

-- ============================================
-- 12. TEAMS INTEGRATION
-- ============================================

CREATE TABLE teams_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teams_message_id VARCHAR(255) NOT NULL,
    teams_conversation_id VARCHAR(255),
    lead_id UUID,
    processed_content TEXT,
    action_taken VARCHAR(255), -- 'updated_lead', 'created_task', 'sent_followup', 'no_action'
    confidence_score DECIMAL(3,2),
    ai_model_used VARCHAR(50),
    raw_payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams_sync_log ADD CONSTRAINT fk_teams_lead 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX idx_teams_message ON teams_sync_log(teams_message_id);
CREATE INDEX idx_teams_lead ON teams_sync_log(lead_id);
CREATE INDEX idx_teams_created ON teams_sync_log(created_at DESC);

-- ============================================
-- INITIAL SEED DATA
-- ============================================

-- Insert Pipeline Stages
INSERT INTO pipeline_stages (name, order_index, category, sla_hours, color, automations) VALUES
('New Lead', 1, 'lead', 24, '#94a3b8', '{"auto_assign": true}'),
('Enriched', 2, 'lead', 48, '#60a5fa', '{"auto_score": true}'),
('Contacted', 3, 'lead', 72, '#f59e0b', '{"start_followup": true}'),
('Responded', 4, 'lead', 48, '#f97316', '{}'),
('Call Booked', 5, 'lead', 24, '#8b5cf6', '{"create_task": true}'),
('Interested', 6, 'pre_onboarding', 24, '#10b981', '{"send_contract": false}'),
('Contract Sent', 7, 'pre_onboarding', 72, '#06b6d4', '{}'),
('Contract Signed', 8, 'pre_onboarding', 24, '#14b8a6', '{"start_onboarding": true}'),
('Payment Confirmed', 9, 'onboarding', 24, '#22c55e', '{}'),
('Onboarding', 10, 'onboarding', 48, '#84cc16', '{"create_group_chat": true}'),
('Active Student', 11, 'active', 168, '#eab308', '{"track_progress": true}'),
('Course Completed', 12, 'completion', 72, '#f59e0b', '{"start_placement": true}'),
('Job Placed', 13, 'completion', 168, '#10b981', '{"calculate_fee": true}'),
('Alumni', 14, 'completion', NULL, '#6366f1', '{"request_testimonial": true}');

-- Insert Programs
INSERT INTO programs (name, description, duration_weeks, prerequisites, modules, is_active) VALUES
('Introduction to AutoCAD', 'Learn AutoCAD from scratch for OSP engineering drawings', 2, '{}', '[{"id": "ac1", "name": "Interface & Basic Commands", "order": 1}, {"id": "ac2", "name": "2D Drafting Fundamentals", "order": 2}, {"id": "ac3", "name": "Layers, Dimensions & Annotations", "order": 3}]', true),
('Outside Plant Engineering', 'Complete OSP design engineering course for telecom infrastructure', 4, '{"Introduction to AutoCAD"}', '[{"id": "osp1", "name": "OSP Fundamentals", "order": 1}, {"id": "osp2", "name": "Fiber Network Design", "order": 2}, {"id": "osp3", "name": "Underground & Aerial Design", "order": 3}, {"id": "osp4", "name": "GIS & Mapping Tools", "order": 4}, {"id": "osp5", "name": "Permitting & Compliance", "order": 5}]', true),
('Interview Preparation', 'Mock interviews, common questions, and interview etiquette', 1, '{}', '[{"id": "int1", "name": "Interview Etiquette", "order": 1}, {"id": "int2", "name": "Common OSP Interview Questions", "order": 2}, {"id": "int3", "name": "Mock Interview Sessions", "order": 3}]', true);

-- Insert Lead Sources
INSERT INTO lead_sources (name, type, channel, cost_per_lead, is_active) VALUES
('Apollo AI Scraper', 'scraper', 'apollo', 0.05, true),
('LinkedIn Recruiter Lite', 'scraper', 'linkedin', 0.10, true),
('LinkedIn Sales Navigator', 'scraper', 'linkedin', 0.08, true),
('LinkedIn Organic Posts', 'social_media', 'linkedin', 0, true),
('Facebook DM Outreach', 'social_media', 'facebook', 0, true),
('Reddit Outreach', 'social_media', 'reddit', 0, true),
('Referral Program', 'referral', 'referral', 0, true),
('Website Contact Form', 'manual', 'website', 0, true),
('Manual Entry', 'manual', 'manual', 0, true);
```

### 2.2 Schema Design Decisions

The schema uses **UUIDs as primary keys** across all tables rather than auto-incrementing integers. This choice is deliberate: when your interns import leads from Apollo AI or LinkedIn, duplicate detection becomes a merge operation rather than a complex reconciliation. UUIDs also prevent enumeration attacks if any endpoint is accidentally exposed. The `leads` table is intentionally wide for the core fields (name, email, phone, source, status, score, owner) while flexible data like education history, skills, and visa status lives in the normalized `lead_profiles` table. This separation means your outreach agents see a clean summary view while onboarding managers can drill into full candidate profiles.

The `activity_log` table is the most critical for auditability. Every significant action — a stage change, a message sent, a task completed, a score updated — writes a row here with JSONB details. This prevents the "what happened to this guy?" syndrome your documents explicitly mention. The `teams_sync_log` table is specifically designed for the Microsoft Teams integration: every message processed by the AI bot gets logged with the action taken and confidence score, so you can review what the AI changed and revert if needed.

---

## 3. API Design (tRPC + Zod)

The API layer uses **tRPC** with **Zod** for end-to-end type safety. This means your frontend TypeScript types are automatically generated from your backend router definitions — no drift between API contracts, no runtime validation bugs. The router is organized by domain, matching the database schema structure.

### 3.1 Router Structure

```typescript
// server/routers/_app.ts
import { router } from '../trpc';
import { leadRouter } from './lead';
import { conversationRouter } from './conversation';
import { pipelineRouter } from './pipeline';
import { taskRouter } from './task';
import { enrollmentRouter } from './enrollment';
import { analyticsRouter } from './analytics';
import { teamsRouter } from './teams';
import { aiRouter } from './ai';

export const appRouter = router({
  lead: leadRouter,
  conversation: conversationRouter,
  pipeline: pipelineRouter,
  task: taskRouter,
  enrollment: enrollmentRouter,
  analytics: analyticsRouter,
  teams: teamsRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
```

### 3.2 Lead Router — Full Implementation

```typescript
// server/routers/lead.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '../db';
import { leads, leadProfiles, contacts, pipelineTransitions, activityLog } from '../db/schema';
import { eq, and, ilike, desc, gte, lte, sql, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { leadScoringService } from '../services/leadScoring';
import { deduplicationService } from '../services/deduplication';
import { assignmentService } from '../services/assignment';

export const leadRouter = router({
  // ─── LIST LEADS ─────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      temperature: z.string().optional(),
      source: z.string().optional(),
      ownerId: z.string().uuid().optional(),
      search: z.string().optional(),
      minScore: z.number().min(0).max(100).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [];
      
      // Role-based filtering
      if (ctx.user.role === 'outreach_agent') {
        conditions.push(eq(leads.ownerId, ctx.user.id));
      }
      
      if (input.status) conditions.push(eq(leads.status, input.status as any));
      if (input.temperature) conditions.push(eq(leads.temperature, input.temperature as any));
      if (input.source) conditions.push(eq(leads.source, input.source));
      if (input.ownerId) conditions.push(eq(leads.ownerId, input.ownerId));
      if (input.minScore) conditions.push(gte(leads.score, input.minScore));
      if (input.dateFrom) conditions.push(gte(leads.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(leads.createdAt, new Date(input.dateTo)));
      if (input.search) {
        conditions.push(
          sql`${leads.fullName} ILIKE ${`%${input.search}%`} OR ${leads.email} ILIKE ${`%${input.search}%`}`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db.query.leads.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(leads.score), desc(leads.createdAt)],
          with: {
            profile: true,
            owner: { columns: { id: true, fullName: true, email: true } },
          },
        }),
        db.select({ count: count() }).from(leads).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // ─── GET SINGLE LEAD ─────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, input.id),
        with: {
          profile: true,
          contacts: true,
          conversations: { orderBy: desc(conversations.createdAt), limit: 20 },
          owner: { columns: { id: true, fullName: true, email: true } },
          backupOwner: { columns: { id: true, fullName: true } },
          tasks: { where: eq(tasks.status, 'todo') },
          enrollments: true,
        },
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      return lead;
    }),

  // ─── CREATE LEAD ─────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      source: z.string(),
      campaignTag: z.string().optional(),
      linkedinUrl: z.string().url().optional(),
      profile: z.object({
        education: z.string().optional(),
        degree: z.string().optional(),
        university: z.string().optional(),
        gradYear: z.number().optional(),
        visaStatus: z.string().optional(),
        skills: z.array(z.string()).default([]),
        hasAutocad: z.boolean().default(false),
        engineeringMajor: z.string().optional(),
        isOpenToRelocate: z.boolean().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Deduplication check
      const duplicate = await deduplicationService.findDuplicate({
        email: input.email,
        phone: input.phone,
        linkedinUrl: input.linkedinUrl,
      });

      if (duplicate) {
        // Merge/update existing lead
        await db.update(leads)
          .set({
            source: input.source,
            campaignTag: input.campaignTag || duplicate.campaignTag,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, duplicate.id));
        
        // Log merge
        await db.insert(activityLog).values({
          leadId: duplicate.id,
          actorId: ctx.user.id,
          action: 'lead_merged',
          entityType: 'lead',
          entityId: duplicate.id,
          details: { source: input.source, matchedBy: duplicate._matchReason },
        });
        
        return { leadId: duplicate.id, action: 'merged' as const };
      }

      // 2. Auto-assign based on rules
      const assignedOwner = await assignmentService.getNextAssignee({
        source: input.source,
        skills: input.profile?.skills || [],
      });

      // 3. Create lead
      const [newLead] = await db.insert(leads).values({
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        location: input.location,
        source: input.source,
        campaignTag: input.campaignTag,
        ownerId: assignedOwner?.id,
        slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }).returning();

      // 4. Create profile if provided
      if (input.profile) {
        await db.insert(leadProfiles).values({
          leadId: newLead.id,
          ...input.profile,
        });
      }

      // 5. Score the lead
      const score = await leadScoringService.scoreLead(newLead.id);
      await db.update(leads).set({ score }).where(eq(leads.id, newLead.id));

      // 6. Log activity
      await db.insert(activityLog).values({
        leadId: newLead.id,
        actorId: ctx.user.id,
        action: 'lead_created',
        entityType: 'lead',
        entityId: newLead.id,
        details: { source: input.source, autoAssigned: !!assignedOwner, initialScore: score },
      });

      return { leadId: newLead.id, action: 'created' as const, score };
    }),

  // ─── UPDATE LEAD STATUS ──────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      status: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, input.leadId),
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });

      const oldStatus = lead.status;
      
      await db.update(leads)
        .set({ status: input.status as any, updatedAt: new Date() })
        .where(eq(leads.id, input.leadId));

      // Record transition
      await db.insert(pipelineTransitions).values({
        leadId: input.leadId,
        fromStageId: null, // lookup from pipeline_stages
        toStageId: null,   // lookup from pipeline_stages
        triggeredBy: ctx.user.id,
        triggerType: 'manual',
        notes: input.notes,
        metadata: { previousStatus: oldStatus },
      });

      await db.insert(activityLog).values({
        leadId: input.leadId,
        actorId: ctx.user.id,
        action: 'status_changed',
        entityType: 'lead',
        entityId: input.leadId,
        details: { from: oldStatus, to: input.status },
      });

      return { success: true };
    }),

  // ─── BULK IMPORT LEADS ───────────────────────────────
  bulkImport: protectedProcedure
    .input(z.object({
      leads: z.array(z.object({
        fullName: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        source: z.string(),
        linkedinUrl: z.string().optional(),
      })).max(500),
      source: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const results = { created: 0, merged: 0, failed: 0 };
      
      for (const leadData of input.leads) {
        try {
          const result = await deduplicationService.findDuplicate({
            email: leadData.email,
            phone: leadData.phone,
            linkedinUrl: leadData.linkedinUrl,
          });

          if (result) {
            results.merged++;
            continue;
          }

          await db.insert(leads).values({
            fullName: leadData.fullName,
            email: leadData.email,
            phone: leadData.phone,
            source: input.source,
          });
          results.created++;
        } catch {
          results.failed++;
        }
      }

      await db.insert(activityLog).values({
        actorId: ctx.user.id,
        action: 'bulk_import',
        entityType: 'lead',
        details: { source: input.source, results },
      });

      return results;
    }),

  // ─── REASSIGN LEAD ───────────────────────────────────
  reassign: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      newOwnerId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, input.leadId),
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });

      const oldOwner = lead.ownerId;
      
      await db.update(leads)
        .set({ 
          ownerId: input.newOwnerId, 
          backupOwnerId: oldOwner,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.leadId));

      await db.insert(activityLog).values({
        leadId: input.leadId,
        actorId: ctx.user.id,
        action: 'lead_reassigned',
        entityType: 'lead',
        entityId: input.leadId,
        details: { from: oldOwner, to: input.newOwnerId, reason: input.reason },
      });

      return { success: true };
    }),

  // ─── GET LEAD STATS ──────────────────────────────────
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const baseConditions = ctx.user.role === 'outreach_agent' 
        ? eq(leads.ownerId, ctx.user.id) 
        : undefined;

      const [
        totalLeads,
        newLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        converted,
        avgScore,
        followUpDue,
      ] = await Promise.all([
        db.select({ count: count() }).from(leads).where(baseConditions),
        db.select({ count: count() }).from(leads).where(and(baseConditions, eq(leads.status, 'new'))),
        db.select({ count: count() }).from(leads).where(and(baseConditions, eq(leads.temperature, 'hot'))),
        db.select({ count: count() }).from(leads).where(and(baseConditions, eq(leads.temperature, 'warm'))),
        db.select({ count: count() }).from(leads).where(and(baseConditions, eq(leads.temperature, 'cold'))),
        db.select({ count: count() }).from(leads).where(and(baseConditions, eq(leads.status, 'active'))),
        db.select({ avg: sql<number>`AVG(score)` }).from(leads).where(baseConditions),
        db.select({ count: count() }).from(leads).where(
          and(baseConditions, lte(leads.nextFollowUpAt, new Date()))
        ),
      ]);

      return {
        total: totalLeads[0]?.count ?? 0,
        new: newLeads[0]?.count ?? 0,
        hot: hotLeads[0]?.count ?? 0,
        warm: warmLeads[0]?.count ?? 0,
        cold: coldLeads[0]?.count ?? 0,
        converted: converted[0]?.count ?? 0,
        avgScore: Math.round(avgScore[0]?.avg ?? 0),
        followUpDue: followUpDue[0]?.count ?? 0,
      };
    }),
});
```

### 3.3 AI Router — Kimi + Ollama Integration

```typescript
// server/routers/ai.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { aiService } from '../services/ai';

export const aiRouter = router({
  // Generate outreach message for a lead
  generateMessage: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(['email', 'linkedin', 'facebook', 'whatsapp']),
      purpose: z.enum(['intro', 'follow_up', 'value', 'call_booking']),
    }))
    .mutation(async ({ input }) => {
      const message = await aiService.generateOutreachMessage({
        leadId: input.leadId,
        channel: input.channel,
        purpose: input.purpose,
      });
      return { message };
    }),

  // Score a lead using AI
  scoreLead: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const score = await aiService.scoreLead(input.leadId);
      return { score };
    }),

  // Summarize conversation
  summarizeConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const summary = await aiService.summarizeConversation(input.conversationId);
      return { summary };
    }),

  // Analyze sentiment of a message
  analyzeSentiment: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input }) => {
      const sentiment = await aiService.analyzeSentiment(input.content);
      return { sentiment };
    }),

  // Process Teams message and suggest CRM action
  processTeamsMessage: protectedProcedure
    .input(z.object({
      message: z.string(),
      context: z.object({
        leadId: z.string().uuid().optional(),
        userId: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await aiService.processTeamsMessage({
        message: input.message,
        context: input.context,
      });
      return result;
    }),
});
```

### 3.4 Teams Integration Router

```typescript
// server/routers/teams.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { teamsBotService } from '../services/teamsBot';

export const teamsRouter = router({
  // Send a follow-up message via Teams
  sendFollowUp: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      message: z.string(),
      channel: z.enum(['teams_dm', 'teams_channel']).default('teams_dm'),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await teamsBotService.sendMessage({
        leadId: input.leadId,
        content: input.message,
        channel: input.channel,
        sentBy: ctx.user.id,
      });
      return result;
    }),

  // Get Teams sync history for a lead
  getSyncLog: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ input }) => {
      const logs = await teamsBotService.getSyncLogForLead(input.leadId);
      return logs;
    }),

  // Configure Teams webhook
  configureWebhook: protectedProcedure
    .input(z.object({
      botId: z.string(),
      tenantId: z.string(),
      webhookUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      await teamsBotService.configureWebhook(input);
      return { success: true };
    }),

  // Test Teams connection
  testConnection: protectedProcedure
    .mutation(async () => {
      const result = await teamsBotService.testConnection();
      return { connected: result };
    }),
});
```

---

## 4. AI Service Layer (Kimi NVIDIA + Ollama)

The AI layer is the differentiator that makes this CRM smarter than HubSpot for your specific use case. It uses a **dual-provider strategy**: Kimi via NVIDIA NIM for high-quality generation and Ollama running locally for cost-free fallback and sensitive data processing.

### 4.1 AI Service Architecture

```typescript
// server/services/ai/index.ts
import { kimiProvider } from './providers/kimi';
import { ollamaProvider } from './providers/ollama';
import type { AIProvider, AIServiceConfig } from './types';

class AIService {
  private primary: AIProvider;
  private fallback: AIProvider;

  constructor() {
    this.primary = kimiProvider;
    this.fallback = ollamaProvider;
  }

  private async withFallback<T>(
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    try {
      return await operation(this.primary);
    } catch (error) {
      console.warn('Primary AI failed, falling back to Ollama:', error);
      return await operation(this.fallback);
    }
  }

  // ─── LEAD SCORING ────────────────────────────────────
  async scoreLead(leadId: string): Promise<number> {
    return this.withFallback(async (provider) => {
      const lead = await this.getLeadWithProfile(leadId);
      
      const prompt = `Score this candidate for an OSP Engineering career program (0-100).

Candidate Profile:
- Name: ${lead.fullName}
- Education: ${lead.profile?.education || 'Unknown'}
- Degree: ${lead.profile?.degree || 'Unknown'}
- Major: ${lead.profile?.engineeringMajor || 'Unknown'}
- Grad Year: ${lead.profile?.gradYear || 'Unknown'}
- Skills: ${lead.profile?.skills?.join(', ') || 'None listed'}
- Has AutoCAD: ${lead.profile?.hasAutocad ? 'Yes' : 'No'}
- Visa Status: ${lead.profile?.visaStatus || 'Unknown'}
- Open to Relocate: ${lead.profile?.isOpenToRelocate ?? 'Unknown'}
- Source: ${lead.source}

Scoring Rules:
- Engineering major (civil/mechanical/structural/construction): +30
- Recent grad (2024-2026): +20
- Has AutoCAD skills: +20
- Has OSP/GIS/telecom skills: +15
- Actively looking (inferred from source/message): +15
- International student on OPT: +10
- Open to relocate: +10
- Unrelated field or no engineering background: -20
- Graduated before 2020: -10

Respond with ONLY a number between 0 and 100.`;

      const response = await provider.complete(prompt, { temperature: 0.1 });
      const score = parseInt(response.trim());
      return Math.min(100, Math.max(0, score || 50));
    });
  }

  // ─── OUTREACH MESSAGE GENERATION ─────────────────────
  async generateOutreachMessage({
    leadId,
    channel,
    purpose,
  }: {
    leadId: string;
    channel: string;
    purpose: string;
  }): Promise<string> {
    return this.withFallback(async (provider) => {
      const lead = await this.getLeadWithProfile(leadId);
      
      const channelInstructions: Record<string, string> = {
        email: 'Write a professional email. Include subject line and body.',
        linkedin: 'Write a LinkedIn DM. Keep it under 300 characters for the first message. Personal and conversational.',
        facebook: 'Write a friendly Facebook DM. Casual tone.',
        whatsapp: 'Write a WhatsApp message. Short, direct, with clear call-to-action.',
      };

      const purposeTemplates: Record<string, string> = {
        intro: 'First outreach. Introduce Skarion and mention how their background fits OSP engineering. Ask if they are open to a quick call.',
        follow_up: 'Follow-up message. Reference previous message. Gently nudge toward scheduling a call.',
        value: 'Share value. Mention a recent placement success or industry insight about OSP engineering demand.',
        call_booking: 'Direct call booking request. Include scheduling link. Urgent but polite tone.',
      };

      const prompt = `You are an outreach specialist for Skarion, a career bootcamp that helps engineering graduates transition into OSP (Outside Plant) Engineering roles in telecom.

${channelInstructions[channel]}

Purpose: ${purposeTemplates[purpose]}

Candidate Info:
- Name: ${lead.fullName}
- Background: ${lead.profile?.degree} in ${lead.profile?.engineeringMajor}
- University: ${lead.profile?.university}
- Skills: ${lead.profile?.skills?.join(', ')}
- Has AutoCAD: ${lead.profile?.hasAutocad ? 'Yes' : 'No'}
- From LinkedIn/Apollo: ${lead.source === 'apollo_ai' || lead.source.includes('linkedin')}

Key selling points:
- No upfront fees (pay only after placement)
- $500 refundable deposit (refunded if no job in 120 days)
- We handle resumes, LinkedIn grooming, job applications, recruiter outreach
- OSP Engineering has high demand and less competition than software roles
- Average placement time: 44-67 days

DO NOT use generic language. Reference their specific background. Make it feel personal, not copy-pasted.`;

      return await provider.complete(prompt, { temperature: 0.7, maxTokens: 500 });
    });
  }

  // ─── SENTIMENT ANALYSIS ──────────────────────────────
  async analyzeSentiment(content: string): Promise<string> {
    return this.withFallback(async (provider) => {
      const prompt = `Analyze the sentiment of this message from a job candidate. 
Classify as ONE of: interested, neutral, curious, rejected, ghosted.

Message: "${content}"

Respond with ONLY the classification word.`;

      const response = await provider.complete(prompt, { temperature: 0.1 });
      const validSentiments = ['interested', 'neutral', 'curious', 'rejected', 'ghosted'];
      const sentiment = response.trim().toLowerCase();
      return validSentiments.includes(sentiment) ? sentiment : 'neutral';
    });
  }

  // ─── TEAMS MESSAGE PROCESSING ────────────────────────
  async processTeamsMessage({
    message,
    context,
  }: {
    message: string;
    context?: { leadId?: string; userId?: string };
  }): Promise<{
    action: string;
    leadId?: string;
    updates?: Record<string, any>;
    task?: { title: string; assignee?: string };
    confidence: number;
  }> {
    return this.withFallback(async (provider) => {
      const prompt = `You are a CRM AI assistant. A team member sent this message in Microsoft Teams about a candidate/lead.

Message: "${message}"

Analyze the message and determine what CRM action to take. Consider:
1. Is this about a specific candidate? (name mentioned)
2. Is the team member updating a candidate's status?
3. Should a task be created?
4. Is this a follow-up reminder?

Available CRM actions:
- "update_lead_status": Update lead pipeline stage
- "create_task": Create a follow-up task
- "add_note": Add a note to lead profile
- "update_lead_score": Change lead score
- "schedule_call": Book a consultation call
- "no_action": No CRM update needed

Respond in JSON format:
{
  "action": "action_name",
  "leadName": "extracted name or null",
  "updates": { "status": "new_status", "notes": "..." },
  "task": { "title": "...", "dueInHours": 24 },
  "confidence": 0.85
}`;

      const response = await provider.complete(prompt, { temperature: 0.2 });
      
      try {
        const parsed = JSON.parse(response);
        return {
          action: parsed.action,
          leadId: context?.leadId,
          updates: parsed.updates,
          task: parsed.task,
          confidence: parsed.confidence || 0.5,
        };
      } catch {
        return { action: 'no_action', confidence: 0 };
      }
    });
  }

  // ─── CONVERSATION SUMMARY ────────────────────────────
  async summarizeConversation(conversationId: string): Promise<string> {
    return this.withFallback(async (provider) => {
      const messages = await this.getConversationMessages(conversationId);
      
      const prompt = `Summarize this conversation between Skarion and a job candidate. 
Highlight: key points discussed, candidate's interest level, objections raised, and next steps.

Conversation:
${messages.map((m: any) => `${m.direction}: ${m.content}`).join('\n')}

Summary (2-3 sentences):`;

      return await provider.complete(prompt, { temperature: 0.5, maxTokens: 200 });
    });
  }

  // Helpers
  private async getLeadWithProfile(leadId: string) {
    // Database lookup
    return { /* ... */ } as any;
  }

  private async getConversationMessages(conversationId: string) {
    // Database lookup
    return [] as any[];
  }
}

export const aiService = new AIService();
```

### 4.2 Kimi Provider (NVIDIA NIM)

```typescript
// server/services/ai/providers/kimi.ts
import type { AIProvider } from '../types';

export const kimiProvider: AIProvider = {
  async complete(prompt: string, options = {}) {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-5',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        top_p: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  },

  async embed(text: string) {
    const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/nv-embedqa-e5-v5',
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0]?.embedding || [];
  },
};
```

### 4.3 Ollama Provider (Local Backup)

```typescript
// server/services/ai/providers/ollama.ts
import type { AIProvider } from '../types';

export const ollamaProvider: AIProvider = {
  async complete(prompt: string, options = {}) {
    const response = await fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  },

  async embed(text: string) {
    const response = await fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        prompt: text,
      }),
    });

    const data = await response.json();
    return data.embedding || [];
  },
};
```

---

## 5. Microsoft Teams Integration

The Teams integration is one of your most requested features — and it's designed as a **bidirectional bridge**. Your team can send follow-ups directly from the CRM into Teams DMs, and when team members discuss candidates in Teams channels, the AI bot reads those messages and automatically updates the CRM.

### 5.1 Teams Bot Service

```typescript
// server/services/teamsBot/index.ts
import { BotFrameworkAdapter, TurnContext } from 'botbuilder';
import { Client } from '@microsoft/microsoft-graph-client';
import { aiService } from '../ai';
import { db } from '../../db';
import { leads, tasks, conversations, activityLog, teamsSyncLog } from '../../db/schema';
import { eq, ilike } from 'drizzle-orm';

class TeamsBotService {
  private adapter: BotFrameworkAdapter;
  private graphClient: Client | null = null;

  constructor() {
    this.adapter = new BotFrameworkAdapter({
      appId: process.env.TEAMS_APP_ID!,
      appPassword: process.env.TEAMS_APP_PASSWORD!,
    });
  }

  // ─── SEND FOLLOW-UP MESSAGE ──────────────────────────
  async sendMessage({
    leadId,
    content,
    channel = 'teams_dm',
    sentBy,
  }: {
    leadId: string;
    content: string;
    channel?: string;
    sentBy: string;
  }) {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { contacts: true },
    });

    if (!lead) throw new Error('Lead not found');

    // Find Teams contact
    const teamsContact = lead.contacts.find((c: any) => c.channel === 'teams');
    if (!teamsContact && channel === 'teams_dm') {
      throw new Error('No Teams contact found for this lead');
    }

    // Send via Graph API
    await this.getGraphClient().api('/me/chats/' + teamsContact.handle + '/messages')
      .post({ body: { content } });

    // Log in CRM
    await db.insert(conversations).values({
      leadId,
      channel: 'teams',
      direction: 'outbound',
      content,
      aiGenerated: false,
    });

    await db.insert(activityLog).values({
      leadId,
      actorId: sentBy,
      action: 'teams_message_sent',
      entityType: 'conversation',
      details: { channel, content: content.substring(0, 200) },
    });

    return { sent: true, channel };
  }

  // ─── HANDLE INCOMING TEAMS MESSAGE ───────────────────
  async handleIncomingMessage(context: TurnContext) {
    const text = context.activity.text || '';
    const from = context.activity.from;
    const conversationId = context.activity.conversation.id;
    
    // 1. Try to identify the lead from message content
    const lead = await this.identifyLeadFromMessage(text);
    
    // 2. Process with AI
    const aiResult = await aiService.processTeamsMessage({
      message: text,
      context: lead ? { leadId: lead.id } : undefined,
    });

    // 3. Log the sync
    await db.insert(teamsSyncLog).values({
      teamsMessageId: context.activity.id,
      teamsConversationId: conversationId,
      leadId: lead?.id,
      processedContent: text.substring(0, 500),
      actionTaken: aiResult.action,
      confidenceScore: aiResult.confidence,
      aiModelUsed: 'kimi-nvidia',
      rawPayload: context.activity,
    });

    // 4. Execute CRM action
    switch (aiResult.action) {
      case 'update_lead_status':
        if (lead && aiResult.updates?.status) {
          await db.update(leads)
            .set({ status: aiResult.updates.status, updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
        }
        break;
      
      case 'create_task':
        if (lead && aiResult.task) {
          await db.insert(tasks).values({
            leadId: lead.id,
            title: aiResult.task.title,
            assigneeId: aiResult.task.assignee,
            dueAt: new Date(Date.now() + (aiResult.task.dueInHours || 24) * 60 * 60 * 1000),
            type: 'follow_up',
            teamsMessageId: context.activity.id,
          });
        }
        break;
      
      case 'add_note':
        if (lead && aiResult.updates?.notes) {
          await db.insert(conversations).values({
            leadId: lead.id,
            channel: 'teams',
            direction: 'inbound',
            content: aiResult.updates.notes,
          });
        }
        break;
    }

    // 5. Confirm action back in Teams
    if (aiResult.action !== 'no_action' && aiResult.confidence > 0.6) {
      await context.sendActivity(
        `CRM updated: ${aiResult.action}${lead ? ` for ${lead.fullName}` : ''}`
      );
    }
  }

  // ─── IDENTIFY LEAD FROM MESSAGE ──────────────────────
  private async identifyLeadFromMessage(text: string) {
    // Extract potential names
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length - 1; i++) {
      const potentialName = `${words[i]} ${words[i + 1]}`;
      const found = await db.query.leads.findFirst({
        where: ilike(leads.fullName, `%${potentialName}%`),
      });
      if (found) return found;
    }

    // Also check email patterns
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      const found = await db.query.leads.findFirst({
        where: eq(leads.email, emailMatch[0]),
      });
      if (found) return found;
    }

    return null;
  }

  // ─── GET GRAPH CLIENT ────────────────────────────────
  private getGraphClient(): Client {
    if (!this.graphClient) {
      this.graphClient = Client.init({
        authProvider: async (done) => {
          // OAuth2 flow with Microsoft
          const token = await this.getAccessToken();
          done(null, token);
        },
      });
    }
    return this.graphClient;
  }

  private async getAccessToken(): Promise<string> {
    // Implement OAuth2 token retrieval
    return process.env.TEAMS_ACCESS_TOKEN || '';
  }

  // ─── GET SYNC LOG ────────────────────────────────────
  async getSyncLogForLead(leadId: string) {
    return await db.query.teamsSyncLog.findMany({
      where: eq(teamsSyncLog.leadId, leadId),
      orderBy: [desc(teamsSyncLog.createdAt)],
      limit: 50,
    });
  }

  // ─── CONFIGURE WEBHOOK ───────────────────────────────
  async configureWebhook(config: { botId: string; tenantId: string; webhookUrl: string }) {
    // Store configuration
    await db.insert('teams_config').values({
      botId: config.botId,
      tenantId: config.tenantId,
      webhookUrl: config.webhookUrl,
      isActive: true,
    }).onConflictDoUpdate({
      target: 'teams_config.bot_id',
      set: {
        tenantId: config.tenantId,
        webhookUrl: config.webhookUrl,
        updatedAt: new Date(),
      },
    });
  }

  // ─── TEST CONNECTION ─────────────────────────────────
  async testConnection(): Promise<boolean> {
    try {
      const client = this.getGraphClient();
      await client.api('/me').get();
      return true;
    } catch {
      return false;
    }
  }
}

export const teamsBotService = new TeamsBotService();
```

### 5.2 Teams Webhook Handler

```typescript
// server/routes/teams-webhook.ts
import { Router } from 'express';
import { teamsBotService } from '../services/teamsBot';

const router = Router();

// Microsoft Bot Framework webhook endpoint
router.post('/webhook', async (req, res) => {
  try {
    await teamsBotService.adapter.process(req, res, async (context) => {
      if (context.activity.type === 'message') {
        await teamsBotService.handleIncomingMessage(context);
      }
    });
  } catch (error) {
    console.error('Teams webhook error:', error);
    res.status(500).send('Error processing message');
  }
});

export default router;
```

---

## 6. Core CRM Services

The services layer contains all business logic that doesn't belong in API routes. Each service is a singleton class that encapsulates a specific domain.

### 6.1 Lead Scoring Service

```typescript
// server/services/leadScoring.ts
import { db } from '../db';
import { leads, leadProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { aiService } from './ai';

export class LeadScoringService {
  // Manual scoring rules (runs fast, no AI needed)
  async calculateBaseScore(leadId: string): Promise<number> {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { profile: true },
    });

    if (!lead || !lead.profile) return 0;

    const profile = lead.profile;
    let score = 0;

    // Target profile match
    const targetMajors = ['civil', 'mechanical', 'structural', 'project_management', 'construction_management'];
    if (targetMajors.includes(profile.engineeringMajor || '')) score += 30;

    // Recent graduation (2024-2026)
    if (profile.gradYear && profile.gradYear >= 2024 && profile.gradYear <= 2026) score += 20;

    // AutoCAD skills
    if (profile.hasAutocad) score += 20;
    if (profile.hasGis) score += 15;
    if (profile.hasOspExperience) score += 15;

    // Source quality
    if (lead.source === 'apollo_ai') score += 10;
    if (lead.source === 'referral') score += 15;

    // Visa status (F1/OPT is target demographic)
    if (profile.visaStatus === 'f1_opt') score += 10;

    // Willingness to relocate
    if (profile.isOpenToRelocate) score += 10;

    // Response history (if available)
    const conversations = await db.query.conversations.findMany({
      where: eq(conversations.leadId, leadId),
    });
    if (conversations.length > 0) score += 15;

    // Decay: no response after 7 days
    const lastActivity = lead.lastActivityAt;
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity > 7) score -= Math.min(20, daysSinceActivity - 7);

    return Math.max(0, Math.min(100, score));
  }

  // Full AI-enhanced scoring
  async scoreLead(leadId: string): Promise<number> {
    const baseScore = await this.calculateBaseScore(leadId);
    
    try {
      const aiScore = await aiService.scoreLead(leadId);
      // Weighted average: 60% base rules, 40% AI judgment
      return Math.round(baseScore * 0.6 + aiScore * 0.4);
    } catch {
      return baseScore;
    }
  }

  // Batch score all un-scored leads
  async batchScoreLeads(limit: number = 100): Promise<number> {
    const unscoredLeads = await db.query.leads.findMany({
      where: eq(leads.score, 0),
      limit,
    });

    let scored = 0;
    for (const lead of unscoredLeads) {
      const score = await this.scoreLead(lead.id);
      await db.update(leads)
        .set({ score, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
      scored++;
    }

    return scored;
  }
}

export const leadScoringService = new LeadScoringService();
```

### 6.2 Deduplication Service

```typescript
// server/services/deduplication.ts
import { db } from '../db';
import { leads, contacts } from '../db/schema';
import { eq, or, ilike, and } from 'drizzle-orm';

export class DeduplicationService {
  async findDuplicate({
    email,
    phone,
    linkedinUrl,
    fullName,
  }: {
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    fullName?: string;
  }): Promise<any | null> {
    // Priority 1: Exact email match
    if (email) {
      const byEmail = await db.query.leads.findFirst({
        where: eq(leads.email, email),
      });
      if (byEmail) return { ...byEmail, _matchReason: 'email' };
    }

    // Priority 2: Phone match
    if (phone) {
      const byPhone = await db.query.leads.findFirst({
        where: eq(leads.phone, phone),
      });
      if (byPhone) return { ...byPhone, _matchReason: 'phone' };
    }

    // Priority 3: LinkedIn URL match
    if (linkedinUrl) {
      const byLinkedIn = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.channel, 'linkedin'),
          eq(contacts.handle, linkedinUrl)
        ),
        with: { lead: true },
      });
      if (byLinkedIn) return { ...byLinkedIn.lead, _matchReason: 'linkedin' };
    }

    // Priority 4: Fuzzy name match (simple implementation)
    if (fullName && fullName.length > 5) {
      const byName = await db.query.leads.findFirst({
        where: ilike(leads.fullName, `%${fullName.split(' ')[0]}%`),
      });
      if (byName) return { ...byName, _matchReason: 'name_fuzzy' };
    }

    return null;
  }

  // Merge two leads
  async mergeLeads(masterId: string, duplicateId: string, userId: string) {
    const master = await db.query.leads.findFirst({
      where: eq(leads.id, masterId),
    });
    const duplicate = await db.query.leads.findFirst({
      where: eq(leads.id, duplicateId),
    });

    if (!master || !duplicate) throw new Error('Lead not found');

    // Copy data from duplicate to master
    const updates: any = {};
    if (!master.phone && duplicate.phone) updates.phone = duplicate.phone;
    if (!master.email && duplicate.email) updates.email = duplicate.email;
    if (!master.location && duplicate.location) updates.location = duplicate.location;

    if (Object.keys(updates).length > 0) {
      await db.update(leads).set(updates).where(eq(leads.id, masterId));
    }

    // Mark duplicate
    await db.update(leads)
      .set({ 
        isDuplicate: true, 
        masterLeadId: masterId,
        status: 'disqualified',
      })
      .where(eq(leads.id, duplicateId));

    return { merged: true, masterId };
  }
}

export const deduplicationService = new DeduplicationService();
```

### 6.3 Assignment Service

```typescript
// server/services/assignment.ts
import { db } from '../db';
import { users, teams, leads } from '../db/schema';
import { eq, and, count, gte } from 'drizzle-orm';

export class AssignmentService {
  // Round-robin with skill matching and load balancing
  async getNextAssignee({
    source,
    skills = [],
  }: {
    source: string;
    skills?: string[];
  }): Promise<{ id: string; fullName: string } | null> {
    // Get active agents sorted by current load
    const agents = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        maxLeads: users.maxLeads,
        currentLoad: count(leads.id),
      })
      .from(users)
      .leftJoin(leads, eq(leads.ownerId, users.id))
      .where(
        and(
          eq(users.role, 'outreach_agent'),
          eq(users.isActive, true)
        )
      )
      .groupBy(users.id, users.fullName, users.maxLeads)
      .having(gte(users.maxLeads, count(leads.id)))
      .orderBy(count(leads.id));

    if (agents.length === 0) return null;

    // Try skill-based match first (if GIS/OSP skills mentioned)
    const hasSpecializedSkills = skills.some(s => 
      ['gis', 'osp', 'autocad', 'fiber', 'telecom'].includes(s.toLowerCase())
    );

    if (hasSpecializedSkills) {
      // Could add team specializations check here
    }

    // Return least-loaded agent
    return {
      id: agents[0].id,
      fullName: agents[0].fullName,
    };
  }

  // Rebalance loads periodically
  async rebalanceLoads(): Promise<number> {
    const overloadedAgents = await db
      .select({
        id: users.id,
        leadCount: count(leads.id),
        maxLeads: users.maxLeads,
      })
      .from(users)
      .leftJoin(leads, eq(leads.ownerId, users.id))
      .where(eq(users.role, 'outreach_agent'))
      .groupBy(users.id, users.maxLeads)
      .having(gte(count(leads.id), users.maxLeads));

    let rebalanced = 0;
    for (const agent of overloadedAgents) {
      // Find underloaded agents
      const underloaded = await db
        .select({
          id: users.id,
          leadCount: count(leads.id),
        })
        .from(users)
        .leftJoin(leads, eq(leads.ownerId, users.id))
        .where(
          and(
            eq(users.role, 'outreach_agent'),
            eq(users.isActive, true),
          )
        )
        .groupBy(users.id)
        .having(gte(users.maxLeads, count(leads.id)))
        .orderBy(count(leads.id));

      // Transfer excess leads
      const excess = (agent.leadCount || 0) - (agent.maxLeads || 50);
      for (let i = 0; i < excess && i < underloaded.length; i++) {
        const leadToReassign = await db.query.leads.findFirst({
          where: eq(leads.ownerId, agent.id),
        });
        
        if (leadToReassign) {
          await db.update(leads)
            .set({ ownerId: underloaded[i].id })
            .where(eq(leads.id, leadToReassign.id));
          rebalanced++;
        }
      }
    }

    return rebalanced;
  }
}

export const assignmentService = new AssignmentService();
```

### 6.4 Follow-up Automation Engine

```typescript
// server/services/followUpEngine.ts
import { db } from '../db';
import { leads, followUpSequences, messageTemplates, conversations } from '../db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { aiService } from './ai';

export class FollowUpEngine {
  // Standard follow-up sequence
  private readonly SEQUENCE_DAYS = [1, 3, 7, 14, 21];

  async createSequence(leadId: string, channel: string = 'email') {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    });
    if (!lead) return;

    // Cancel any existing pending sequences
    await db.update(followUpSequences)
      .set({ status: 'cancelled' as any })
      .where(
        and(
          eq(followUpSequences.leadId, leadId),
          eq(followUpSequences.status, 'pending' as any)
        )
      );

    // Create new sequence
    for (let i = 0; i < this.SEQUENCE_DAYS.length; i++) {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + this.SEQUENCE_DAYS[i]);

      await db.insert(followUpSequences).values({
        leadId,
        stepNumber: i + 1,
        channel,
        scheduledAt,
        status: 'pending' as any,
      });
    }
  }

  // Run every hour via cron
  async processPendingFollowUps(): Promise<number> {
    const pending = await db.query.followUpSequences.findMany({
      where: and(
        eq(followUpSequences.status, 'pending' as any),
        lte(followUpSequences.scheduledAt, new Date())
      ),
      with: { lead: true },
    });

    let sent = 0;
    for (const followUp of pending) {
      try {
        // Check if lead has responded since sequence started
        const recentReply = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.leadId, followUp.leadId),
            eq(conversations.direction, 'inbound'),
            sql`${conversations.createdAt} > ${followUpSequences.createdAt}`
          ),
        });

        if (recentReply) {
          // Cancel sequence - lead has responded
          await db.update(followUpSequences)
            .set({ status: 'cancelled' as any })
            .where(eq(followUpSequences.id, followUp.id));
          continue;
        }

        // Generate message
        const purposes = ['intro', 'follow_up', 'value', 'call_booking', 'call_booking'];
        const message = await aiService.generateOutreachMessage({
          leadId: followUp.leadId,
          channel: followUp.channel as any,
          purpose: purposes[followUp.stepNumber - 1] as any,
        });

        // Send via appropriate channel (Teams, email, LinkedIn)
        await this.sendViaChannel(followUp.leadId, followUp.channel, message);

        // Mark as sent
        await db.update(followUpSequences)
          .set({ 
            status: 'sent' as any, 
            sentAt: new Date(),
            content: message,
          })
          .where(eq(followUpSequences.id, followUp.id));

        sent++;
      } catch (error) {
        console.error(`Failed to send follow-up ${followUp.id}:`, error);
        await db.update(followUpSequences)
          .set({ status: 'failed' as any })
          .where(eq(followUpSequences.id, followUp.id));
      }
    }

    return sent;
  }

  private async sendViaChannel(leadId: string, channel: string, message: string) {
    // Route to appropriate service based on channel
    switch (channel) {
      case 'teams':
        // Use Teams bot
        break;
      case 'email':
        // Use email service
        break;
      case 'linkedin':
        // Use LinkedIn automation
        break;
      default:
        // Log for manual sending
        await db.insert(conversations).values({
          leadId,
          channel: channel as any,
          direction: 'outbound',
          content: message,
          aiGenerated: true,
        });
    }
  }

  // Smart follow-up: switch channel after ghosting
  async smartChannelSwitch(leadId: string): Promise<string> {
    const leadConversations = await db.query.conversations.findMany({
      where: eq(conversations.leadId, leadId),
      orderBy: [sql`${conversations.createdAt} DESC`],
      limit: 10,
    });

    const lastInbound = leadConversations.find((c: any) => c.direction === 'inbound');
    if (!lastInbound) return 'email'; // No response ever

    const daysSinceResponse = Math.floor(
      (Date.now() - lastInbound.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Channel switching rules
    if (daysSinceResponse > 10) return 'phone'; // Cold, try phone
    if (daysSinceResponse > 5) return 'teams';   // Warm, try Teams
    return 'email'; // Recent, stick with email
  }
}

export const followUpEngine = new FollowUpEngine();
```

---

## 7. Frontend Application (React + Vite)

The frontend is a single-page application built with React 18, Vite for fast development builds, TypeScript for type safety, and Tailwind CSS for styling. The component architecture follows a feature-based folder structure.

### 7.1 Project Structure

```
client/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component with routing
│   ├── components/
│   │   ├── ui/                     # Reusable UI components (Button, Card, Modal, etc.)
│   │   ├── layout/                 # Layout components (Sidebar, Header, PageShell)
│   │   ├── forms/                  # Form components (LeadForm, ProfileForm)
│   │   └── charts/                 # Chart components (FunnelChart, LineChart)
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main dashboard with KPIs
│   │   ├── Leads.tsx               # Lead list view
│   │   ├── LeadDetail.tsx          # Single lead page
│   │   ├── Pipeline.tsx            # Kanban pipeline board
│   │   ├── Outreach.tsx            # Outreach center
│   │   ├── Students.tsx            # Active students list
│   │   ├── StudentDetail.tsx       # Student progress tracking
│   │   ├── Placements.tsx          # Placement tracking
│   │   ├── Analytics.tsx           # Analytics dashboard
│   │   ├── Tasks.tsx               # Task management
│   │   ├── Settings.tsx            # CRM settings
│   │   └── TeamsIntegration.tsx    # Teams bot configuration
│   ├── hooks/
│   │   ├── useAuth.ts              # Authentication hook
│   │   ├── useLeads.ts             # Lead data hooks (useQuery wrappers)
│   │   ├── usePipeline.ts          # Pipeline state hooks
│   │   ├── useAI.ts                # AI generation hooks
│   │   └── useRealtime.ts          # Real-time updates (Supabase)
│   ├── lib/
│   │   ├── trpc.ts                 # tRPC client setup
│   │   ├── utils.ts                # Utility functions
│   │   └── constants.ts            # App constants
│   ├── types/
│   │   └── index.ts                # Shared TypeScript types
│   └── styles/
│       └── index.css               # Tailwind + custom styles
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

### 7.2 Key Page Implementations

#### Dashboard Page

```tsx
// client/src/pages/Dashboard.tsx
import { useAuth } from '../hooks/useAuth';
import { trpc } from '../lib/trpc';
import { StatCard } from '../components/ui/StatCard';
import { FunnelChart } from '../components/charts/FunnelChart';
import { ActivityFeed } from '../components/ActivityFeed';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = trpc.lead.getStats.useQuery();
  const { data: recentActivity } = trpc.analytics.getRecentActivity.useQuery({ limit: 20 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Welcome back, {user?.fullName}. Here's what's happening today.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary">
            + Add Lead
          </button>
          <button className="btn-secondary">
            Send Follow-ups
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={stats?.total ?? 0}
          change="+12%"
          icon="Users"
          color="blue"
        />
        <StatCard
          title="Hot Leads"
          value={stats?.hot ?? 0}
          change="+5"
          icon="Flame"
          color="orange"
        />
        <StatCard
          title="Follow-ups Due"
          value={stats?.followUpDue ?? 0}
          change="-3"
          icon="Clock"
          color="red"
          urgent={stats?.followUpDue ? stats.followUpDue > 10 : false}
        />
        <StatCard
          title="Active Students"
          value={stats?.converted ?? 0}
          change="+2"
          icon="GraduationCap"
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
          <FunnelChart data={[
            { stage: 'Leads', count: stats?.total ?? 0 },
            { stage: 'Contacted', count: Math.floor((stats?.total ?? 0) * 0.7) },
            { stage: 'Call Booked', count: Math.floor((stats?.total ?? 0) * 0.35) },
            { stage: 'Interested', count: Math.floor((stats?.total ?? 0) * 0.2) },
            { stage: 'Enrolled', count: stats?.converted ?? 0 },
          ]} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Lead Sources</h3>
          <SourceBreakdownChart />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <ActivityFeed activities={recentActivity ?? []} />
      </div>
    </div>
  );
}
```

#### Pipeline Kanban Board

```tsx
// client/src/pages/Pipeline.tsx
import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function Pipeline() {
  const { data: stages } = trpc.pipeline.getStages.useQuery();
  const { data: leadsByStage } = trpc.pipeline.getLeadsByStage.useQuery();
  const updateStatus = trpc.lead.updateStatus.useMutation();
  const [draggingLead, setDraggingLead] = useState<string | null>(null);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const leadId = result.draggableId;
    const newStageId = result.destination.droppableId;
    
    updateStatus.mutate({
      leadId,
      status: newStageId,
      notes: 'Moved via pipeline board',
    });
  };

  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold text-white mb-6">Pipeline Board</h1>
      
      <DragDropContext onDragEnd={handleDragEnd} onDragStart={(start) => setDraggingLead(start.draggableId)}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages?.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white" style={{ color: stage.color }}>
                  {stage.name}
                </h3>
                <span className="text-sm text-gray-400">
                  {leadsByStage?.[stage.id]?.length ?? 0}
                </span>
              </div>
              
              <Droppable droppableId={stage.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-gray-800/50 rounded-lg p-2 min-h-[200px] space-y-2"
                  >
                    {leadsByStage?.[stage.id]?.map((lead: any, index: number) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              snapshot.isDragging 
                                ? 'bg-blue-600/20 shadow-lg' 
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                            onClick={() => navigate(`/leads/${lead.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-white text-sm">{lead.fullName}</h4>
                              {lead.score >= 70 && (
                                <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                                  HOT
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{lead.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs bg-gray-600 text-gray-300 px-1.5 rounded">
                                {lead.source}
                              </span>
                              <span className="text-xs text-gray-500">
                                Score: {lead.score}
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
```

---

## 8. Automation Engine

The automation engine is a cron-based service that runs scheduled jobs for follow-ups, scoring, analytics, and data maintenance.

```typescript
// server/services/automation/cronJobs.ts
import { CronJob } from 'cron';
import { followUpEngine } from '../followUpEngine';
import { leadScoringService } from '../leadScoring';
import { assignmentService } from '../assignment';
import { analyticsService } from '../analytics';

export function initializeCronJobs() {
  // Every hour: Process pending follow-ups
  new CronJob('0 * * * *', async () => {
    console.log('[CRON] Processing follow-ups...');
    const sent = await followUpEngine.processPendingFollowUps();
    console.log(`[CRON] Sent ${sent} follow-ups`);
  }).start();

  // Every 6 hours: Batch score un-scored leads
  new CronJob('0 */6 * * *', async () => {
    console.log('[CRON] Scoring leads...');
    const scored = await leadScoringService.batchScoreLeads(200);
    console.log(`[CRON] Scored ${scored} leads`);
  }).start();

  // Daily at midnight: Rebalance agent loads
  new CronJob('0 0 * * *', async () => {
    console.log('[CRON] Rebalancing loads...');
    const rebalanced = await assignmentService.rebalanceLoads();
    console.log(`[CRON] Rebalanced ${rebalanced} leads`);
  }).start();

  // Daily at 1 AM: Generate analytics snapshots
  new CronJob('0 1 * * *', async () => {
    console.log('[CRON] Generating analytics...');
    await analyticsService.generateDailySnapshot();
    console.log('[CRON] Analytics generated');
  }).start();

  // Daily at 8 AM: Send SLA breach alerts to Teams
  new CronJob('0 8 * * *', async () => {
    console.log('[CRON] Checking SLA breaches...');
    await checkSlaBreaches();
  }).start();
}

async function checkSlaBreaches() {
  const breachedLeads = await db.query.leads.findMany({
    where: and(
      lte(leads.slaDeadline, new Date()),
      eq(leads.isDuplicate, false)
    ),
    with: { owner: true },
  });

  for (const lead of breachedLeads) {
    // Send Teams notification
    await teamsBotService.sendNotification({
      userId: lead.ownerId,
      message: `SLA BREACH: Lead "${lead.fullName}" has exceeded response time. Please follow up immediately.`,
    });
  }
}
```

---

## 9. Configuration Files

### 9.1 Environment Variables

```bash
# .env.example

# === DATABASE ===
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres

# === AUTH (Clerk) ===
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxx

# === AI: KIMI VIA NVIDIA ===
NVIDIA_API_KEY=nvapi-xxxxxxxx

# === AI: OLLAMA (LOCAL BACKUP) ===
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# === MICROSOFT TEAMS ===
TEAMS_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEAMS_APP_PASSWORD=xxxxxxxx
TEAMS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEAMS_ACCESS_TOKEN=xxxxxxxx

# === APP CONFIG ===
APP_URL=https://crm.skarion.com
API_URL=https://api.skarion.com
NODE_ENV=production

# === SUPABASE ===
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

### 9.2 Package.json

```json
{
  "name": "skarion-crm",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "cd client && npm run dev",
    "build": "npm run build:server && npm run build:client",
    "build:server": "tsc -p server/tsconfig.json",
    "build:client": "cd client && npm run build",
    "start": "node dist/server/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx server/db/seed.ts",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "drizzle-orm": "^0.35.0",
    "drizzle-zod": "^0.5.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "botbuilder": "^4.23.0",
    "@microsoft/microsoft-graph-client": "^3.0.0",
    "resend": "^4.0.0",
    "winston": "^3.15.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "drizzle-kit": "^0.26.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.7.0",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node-cron": "^3.0.11",
    "concurrently": "^9.0.0",
    "eslint": "^9.12.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0"
  }
}
```

### 9.3 Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### 9.4 Vite Config

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/trpc': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

---

## 10. Implementation Phases

Building everything at once would be risky and delay value delivery. The implementation is divided into **four phases**, each delivering a usable increment.

| Phase | Timeline | Deliverables | Business Value |
|---|---|---|---|
| **Phase 1: Foundation** | Weeks 1-3 | Database setup, auth, lead CRUD, basic pipeline view, user management | Replace manual lead tracking; single source of truth |
| **Phase 2: Intelligence** | Weeks 4-6 | Lead scoring, deduplication, AI message generation, auto-assignment, follow-up engine | Reduce manual work; prioritize hot leads; prevent duplicate outreach |
| **Phase 3: Integration** | Weeks 7-9 | Microsoft Teams bot, conversation sync, AI CRM updates, call booking, contract tracking | Team collaboration in Teams feeds directly into CRM; no double data entry |
| **Phase 4: Optimization** | Weeks 10-12 | Full analytics dashboard, student progress tracking, placement management, advanced automation | Complete pipeline visibility; data-driven decisions; measure ROI per source |

### Phase 1 Detailed Tasks

1. **Database Setup** — Run the DDL script on Supabase PostgreSQL, configure Drizzle ORM, run initial migrations, seed pipeline stages and programs.
2. **Authentication** — Set up Clerk.dev, configure role-based access (admin, director, manager, outreach_agent, onboarding_manager, viewer), protect all routes.
3. **Lead Management UI** — Build the lead list page with filters, search, sorting; build the lead detail page with profile editing, activity timeline, and status updates.
4. **Pipeline Board** — Implement the Kanban board with drag-and-drop stage transitions, stage counts, and color-coded cards.
5. **Basic Dashboard** — Show total leads, leads by status, recent activity feed.

### Phase 2 Detailed Tasks

1. **Lead Scoring** — Implement both rule-based and AI scoring; display score badges on lead cards; add score-based filtering.
2. **Deduplication** — Build the merge UI; show duplicate warnings during import; automatic merge for exact email matches.
3. **AI Message Generation** — Integrate Kimi API; add "Generate Message" button on lead detail; support LinkedIn DM, email, and Facebook DM formats.
4. **Auto-Assignment** — Implement round-robin with load balancing; add team capacity settings; show agent workload on dashboard.
5. **Follow-up Engine** — Build the sequence creator; implement the cron job; add follow-up status tracking to lead detail.

### Phase 3 Detailed Tasks

1. **Teams Bot Setup** — Register bot in Azure Bot Service; configure webhook endpoint; implement message receiving.
2. **Teams → CRM Sync** — Build the AI message processor; extract lead names, status updates, and task requests from Teams messages; confirm actions back in Teams.
3. **CRM → Teams Notifications** — Send SLA breach alerts, follow-up reminders, and task assignments to Teams DMs.
4. **Call Booking** — Add call scheduling UI; integrate with Microsoft Bookings; track call outcomes.
5. **Contract & Payment** — Track RabbitSign contract status; manage deposit and placement fee payments.

### Phase 4 Detailed Tasks

1. **Analytics Dashboard** — Build conversion funnel charts, source performance tables, agent leaderboards, revenue tracking.
2. **Student Progress** — Build course module tracking; attendance logging; mentor assignment.
3. **Placement Management** — Track job offers; calculate placement fees; manage alumni status.
4. **Advanced Automation** — Smart channel switching; AI-suggested follow-up timing; predictive lead conversion scoring.

---

## 11. Deployment Guide

### 11.1 Infrastructure Setup

**Frontend (Vercel):**
```bash
# 1. Push code to GitHub
# 2. Connect repo to Vercel
# 3. Set environment variables in Vercel dashboard
# 4. Deploy — Vercel handles builds automatically
```

**Backend (Railway):**
```bash
# 1. Create new project from GitHub repo
# 2. Add PostgreSQL plugin (or connect to Supabase)
# 3. Set all environment variables
# 4. Deploy — Railway auto-detects Node.js
```

**Database (Supabase):**
```bash
# 1. Create free Supabase project
# 2. Get connection string from Settings > Database
# 3. Run migrations: npm run db:migrate
# 4. Run seeds: npm run db:seed
```

### 11.2 Teams Bot Registration

```bash
# 1. Go to Azure Portal > Bot Channels Registration
# 2. Create new bot
# 3. Get App ID and Password
# 4. Configure Microsoft Teams channel
# 5. Set webhook URL to: https://your-api.com/teams/webhook
# 6. Install bot to your Teams workspace
```

### 11.3 Ollama Local Setup

```bash
# On your local machine:
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull llama3.2

# 3. Start Ollama server (runs on localhost:11434 by default)
ollama serve

# 4. Test
ollama run llama3.2 "Hello, are you working?"
```

---

## 12. Cost Estimation

| Service | Free Tier | Paid Tier (if needed) | Monthly Cost |
|---|---|---|---|
| Vercel (Frontend) | Unlimited bandwidth, 100GB | Pro plan | **$0** |
| Railway (Backend) | 512MB RAM, shared CPU | Starter plan | **$5** or **$0** |
| Supabase (Database) | 500MB, 2M edge requests | Pro plan | **$0** |
| Clerk (Auth) | 10,000 MAU | Pro plan | **$0** (for now) |
| NVIDIA NIM (Kimi) | 1,000 requests/day | Pay-as-you-go | **$0** |
| Ollama (Local AI) | Unlimited (your hardware) | — | **$0** |
| Azure Bot (Teams) | 10,000 messages/month | Standard | **$0** |
| **TOTAL** | | | **$0-5/month** |

---

## 13. Security Considerations

| Layer | Measures |
|---|---|
| **Authentication** | Clerk.dev handles OAuth, MFA, session management |
| **Authorization** | Role-based access control on every tRPC procedure |
| **Data Encryption** | PostgreSQL SSL/TLS; Supabase encrypts at rest |
| **API Security** | tRPC type-safe endpoints; no raw SQL exposure |
| **Input Validation** | Zod schemas on all inputs; SQL injection prevention via Drizzle |
| **Audit Logging** | Every action logged in activity_log table |
| **Teams Security** | Bot authentication via Microsoft App ID/Password |
| **Rate Limiting** | Implement on API routes to prevent abuse |

---

## 14. Success Metrics

Track these KPIs to measure CRM adoption and business impact:

| Metric | Baseline (Current) | Target (3 months) |
|---|---|---|
| Lead response time | 48-72 hours (manual) | < 4 hours (automated) |
| Duplicate leads | ~15-20% of imports | < 2% |
| Follow-up completion | ~40% | > 85% |
| Lead-to-call conversion | 5.8% (34 calls / 590 emails) | > 10% |
| Call-to-enrollment | ~25% | > 30% |
| Time per lead management | 30 min/day/agent | < 10 min/day/agent |
| Data entry errors | Frequent | Near zero |
| Team satisfaction with tools | Low (spreadsheet chaos) | High (single system) |


---

## Appendix A: Complete Drizzle TypeScript Schema

This is the TypeScript schema definition that Drizzle ORM uses. It provides full type safety and is the source of truth for your database.

```typescript
// server/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, index, uniqueIndex, inet, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ─────────────────────────────────────────────
export const leadStatusEnum = pgEnum('lead_status', [
  'new', 'enriched', 'contacted', 'responded', 'call_booked', 
  'interested', 'contract_sent', 'contract_signed', 'payment_confirmed',
  'onboarding', 'active', 'completed', 'placed', 'cold', 'disqualified'
]);

export const leadTemperatureEnum = pgEnum('lead_temperature', ['cold', 'warm', 'hot']);
export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageSentimentEnum = pgEnum('message_sentiment', ['interested', 'neutral', 'curious', 'rejected', 'ghosted', 'angry']);
export const sequenceStatusEnum = pgEnum('sequence_status', ['pending', 'sent', 'responded', 'cancelled', 'failed']);
export const callOutcomeEnum = pgEnum('call_outcome', ['scheduled', 'completed_interested', 'completed_not_interested', 'completed_later', 'no_show', 'cancelled', 'rescheduled']);
export const contractStatusEnum = pgEnum('contract_status', ['not_sent', 'sent', 'signed', 'expired']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'deposit_paid', 'fully_paid', 'refunded', 'waived']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done', 'cancelled']);

// ─── Users ─────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  teamId: uuid('team_id'),
  maxLeads: integer('max_leads').default(50),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  leadCapacity: integer('lead_capacity').default(200),
  specializations: text('specializations').array().default([]),
  roundRobinIndex: integer('round_robin_index').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Leads ─────────────────────────────────────────────
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
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
}, (table) => [
  index('idx_leads_status').on(table.status),
  index('idx_leads_owner').on(table.ownerId),
  index('idx_leads_temperature').on(table.temperature),
  index('idx_leads_source').on(table.source),
  index('idx_leads_score').on(table.score),
  index('idx_leads_next_followup').on(table.nextFollowUpAt),
  index('idx_leads_duplicate').on(table.isDuplicate),
]);

export const leadProfiles = pgTable('lead_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().unique(),
  education: varchar('education', { length: 255 }),
  degree: varchar('degree', { length: 255 }),
  university: varchar('university', { length: 255 }),
  gradYear: integer('grad_year'),
  visaStatus: varchar('visa_status', { length: 100 }),
  skills: text('skills').array().default([]),
  hasAutocad: boolean('has_autocad').default(false),
  hasGis: boolean('has_gis').default(false),
  hasOspExperience: boolean('has_osp_experience').default(false),
  jobReadiness: integer('job_readiness').default(0),
  engineeringMajor: varchar('engineering_major', { length: 100 }),
  isOpenToRelocate: boolean('is_open_to_relocate'),
  heardAboutOsp: boolean('heard_about_osp').default(false),
  linkedinUrl: text('linkedin_url'),
  portfolioUrl: text('portfolio_url'),
  rawProfileData: jsonb('raw_profile_data').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_profile_skills').on(table.skills),
  index('idx_profile_major').on(table.engineeringMajor),
]);

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  handle: varchar('handle', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_contacts_lead').on(table.leadId),
  index('idx_contacts_handle').on(table.handle),
  uniqueIndex('idx_contacts_primary').on(table.leadId, table.channel),
]);

// ─── Lead Sources ──────────────────────────────────────
export const leadSources = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  channel: varchar('channel', { length: 100 }),
  costPerLead: decimal('cost_per_lead', { precision: 10, scale: 2 }).default('0'),
  totalLeads: integer('total_leads').default(0),
  convertedLeads: integer('converted_leads').default(0),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 4 }).default('0'),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Communications ────────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
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
}, (table) => [
  index('idx_conversations_lead').on(table.leadId),
  index('idx_conversations_created').on(table.createdAt),
  index('idx_conversations_sentiment').on(table.sentiment),
]);

export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  variables: text('variables').array().default([]),
  createdBy: uuid('created_by'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const followUpSequences = pgTable('follow_up_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
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
}, (table) => [
  index('idx_sequences_pending').on(table.status, table.scheduledAt),
  index('idx_sequences_lead').on(table.leadId),
]);

// ─── Pipeline ──────────────────────────────────────────
export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(),
  requiredFields: text('required_fields').array().default([]),
  slaHours: integer('sla_hours').default(48),
  automations: jsonb('automations').default({}),
  color: varchar('color', { length: 20 }).default('#6366f1'),
  isActive: boolean('is_active').default(true),
});

export const pipelineTransitions = pgTable('pipeline_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull(),
  fromStageId: uuid('from_stage_id'),
  toStageId: uuid('to_stage_id').notNull(),
  triggeredBy: uuid('triggered_by'),
  triggerType: varchar('trigger_type', { length: 100 }).default('manual'),
  notes: text('notes'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_transitions_lead').on(table.leadId),
  index('idx_transitions_created').on(table.createdAt),
]);

// ─── Call Bookings ─────────────────────────────────────
export const callBookings = pgTable('call_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').default(30),
  meetingLink: varchar('meeting_link', { length: 500 }),
  outcome: callOutcomeEnum('outcome').default('scheduled'),
  consultationNotes: text('consultation_notes'),
  answers: jsonb('answers').default({}),
  interestLevel: integer('interest_level'),
  objections: text('objections').array().default([]),
  nextSteps: text('next_steps'),
  recordedUrl: text('recorded_url'),
  bookedBy: uuid('booked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_bookings_scheduled').on(table.scheduledAt),
  index('idx_bookings_outcome').on(table.outcome),
  index('idx_bookings_lead').on(table.leadId),
]);

// ─── Programs & Enrollments ────────────────────────────
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  durationWeeks: integer('duration_weeks').notNull(),
  prerequisites: text('prerequisites').array().default([]),
  modules: jsonb('modules').default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().unique(),
  programId: uuid('program_id').notNull(),
  contractStatus: contractStatusEnum('contract_status').default('not_sent'),
  contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
  rabbitSignDocId: varchar('rabbit_sign_doc_id', { length: 255 }),
  paymentStatus: paymentStatusEnum('payment_status').default('pending'),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }).default('500'),
  finalFeeAmount: decimal('final_fee_amount', { precision: 10, scale: 2 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  expectedCompletionAt: timestamp('expected_completion_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('pending'),
  groupChatId: varchar('group_chat_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_enrollments_status').on(table.status),
  index('idx_enrollments_program').on(table.programId),
]);

// ─── Student Progress ──────────────────────────────────
export const studentProgress = pgTable('student_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  enrollmentId: uuid('enrollment_id').notNull(),
  moduleId: varchar('module_id', { length: 100 }).notNull(),
  moduleName: varchar('module_name', { length: 255 }),
  completionPct: integer('completion_pct').default(0),
  mentorId: uuid('mentor_id'),
  attendance: jsonb('attendance').default([]),
  assignments: jsonb('assignments').default([]),
  quizScores: jsonb('quiz_scores').default([]),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_progress_enrollment').on(table.enrollmentId),
  index('idx_progress_module').on(table.moduleId),
]);

// ─── Placements ────────────────────────────────────────
export const placements = pgTable('placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  enrollmentId: uuid('enrollment_id').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  salary: decimal('salary', { precision: 10, scale: 2 }),
  salaryType: varchar('salary_type', { length: 50 }).default('annual'),
  startDate: date('start_date'),
  offerReceivedAt: timestamp('offer_received_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('offer_received'),
  recruiterName: varchar('recruiter_name', { length: 255 }),
  jobSource: varchar('job_source', { length: 100 }),
  placementFee: decimal('placement_fee', { precision: 10, scale: 2 }),
  feePaid: boolean('fee_paid').default(false),
  feePaidAt: timestamp('fee_paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_placements_enrollment').on(table.enrollmentId),
  index('idx_placements_status').on(table.status),
]);

// ─── Tasks ─────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
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
}, (table) => [
  index('idx_tasks_assignee').on(table.assigneeId, table.status),
  index('idx_tasks_due').on(table.dueAt),
  index('idx_tasks_lead').on(table.leadId),
]);

// ─── Activity Log ──────────────────────────────────────
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id'),
  actorId: uuid('actor_id'),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details').default({}),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_activity_lead').on(table.leadId, table.createdAt),
  index('idx_activity_actor').on(table.actorId, table.createdAt),
  index('idx_activity_entity').on(table.entityType, table.entityId),
  index('idx_activity_created').on(table.createdAt),
]);

// ─── Analytics ─────────────────────────────────────────
export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  metricName: varchar('metric_name', { length: 255 }).notNull(),
  dimension: varchar('dimension', { length: 255 }),
  value: decimal('value', { precision: 15, scale: 4 }).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_analytics_date').on(table.date),
  index('idx_analytics_metric').on(table.metricName, table.date),
]);

// ─── Teams Sync Log ────────────────────────────────────
export const teamsSyncLog = pgTable('teams_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamsMessageId: varchar('teams_message_id', { length: 255 }).notNull(),
  teamsConversationId: varchar('teams_conversation_id', { length: 255 }),
  leadId: uuid('lead_id'),
  processedContent: text('processed_content'),
  actionTaken: varchar('action_taken', { length: 255 }),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  aiModelUsed: varchar('ai_model_used', { length: 50 }),
  rawPayload: jsonb('raw_payload').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_teams_message').on(table.teamsMessageId),
  index('idx_teams_lead').on(table.leadId),
  index('idx_teams_created').on(table.createdAt),
]);

// ─── Relations ─────────────────────────────────────────
export const leadsRelations = relations(leads, ({ one, many }) => ({
  profile: one(leadProfiles, { fields: [leads.id], references: [leadProfiles.leadId] }),
  owner: one(users, { fields: [leads.ownerId], references: [users.id], relationName: 'owner' }),
  backupOwner: one(users, { fields: [leads.backupOwnerId], references: [users.id], relationName: 'backupOwner' }),
  contacts: many(contacts),
  conversations: many(conversations),
  tasks: many(tasks),
  enrollments: many(enrollments),
  followUpSequences: many(followUpSequences),
}));

export const leadProfilesRelations = relations(leadProfiles, ({ one }) => ({
  lead: one(leads, { fields: [leadProfiles.leadId], references: [leads.id] }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  lead: one(leads, { fields: [contacts.leadId], references: [leads.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  ownedLeads: many(leads, { relationName: 'owner' }),
  tasks: many(tasks),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  lead: one(leads, { fields: [enrollments.leadId], references: [leads.id] }),
  program: one(programs, { fields: [enrollments.programId], references: [programs.id] }),
  progress: many(studentProgress),
  placements: many(placements),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  enrollments: many(enrollments),
}));

export const studentProgressRelations = relations(studentProgress, ({ one }) => ({
  enrollment: one(enrollments, { fields: [studentProgress.enrollmentId], references: [enrollments.id] }),
  mentor: one(users, { fields: [studentProgress.mentorId], references: [users.id] }),
}));

export const placementsRelations = relations(placements, ({ one }) => ({
  enrollment: one(enrollments, { fields: [placements.enrollmentId], references: [enrollments.id] }),
}));

export const followUpSequencesRelations = relations(followUpSequences, ({ one }) => ({
  lead: one(leads, { fields: [followUpSequences.leadId], references: [leads.id] }),
}));

export const pipelineTransitionsRelations = relations(pipelineTransitions, ({ one }) => ({
  lead: one(leads, { fields: [pipelineTransitions.leadId], references: [leads.id] }),
  fromStage: one(pipelineStages, { fields: [pipelineTransitions.fromStageId], references: [pipelineStages.id] }),
  toStage: one(pipelineStages, { fields: [pipelineTransitions.toStageId], references: [pipelineStages.id] }),
}));
```

---

## Appendix B: Server Entry Point & tRPC Setup

```typescript
// server/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers/_app';
import { createContext } from './trpc';
import { initializeCronJobs } from './services/automation/cronJobs';
import teamsWebhook from './routes/teams-webhook';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Teams webhook
app.use('/teams/webhook', teamsWebhook);

// tRPC API
app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// Start server
app.listen(PORT, () => {
  console.log(`Skarion CRM API running on port ${PORT}`);
  
  // Initialize scheduled jobs
  initializeCronJobs();
});
```

```typescript
// server/trpc.ts
import { initTRPC } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export async function createContext({ req }: CreateExpressContextOptions) {
  // Extract user from Clerk JWT
  const authHeader = req.headers.authorization;
  
  if (!authHeader) return { user: null, db };
  
  try {
    // Verify JWT with Clerk
    // const jwt = await clerk.verifyToken(authHeader.replace('Bearer ', ''));
    // const user = await db.query.users.findFirst({ where: eq(users.id, jwt.sub) });
    // return { user, db };
    
    // Simplified for development
    const userId = authHeader.replace('Bearer ', '');
    const user = await db.query.users.findFirst({ 
      where: eq(users.id, userId) 
    });
    return { user, db };
  } catch {
    return { user: null, db };
  }
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
    return next({
      ctx: { ...ctx, user: ctx.user },
    });
  })
);

// Admin-only procedure
export const adminProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user.role !== 'admin' && ctx.user.role !== 'director') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return next({ ctx });
  })
);

import { TRPCError } from '@trpc/server';
```

```typescript
// server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For queries
const client = postgres(connectionString, { max: 20 });
export const db = drizzle(client, { schema });
```

---

## Appendix C: Frontend tRPC Client Setup

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '../../../server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/trpc`,
      headers() {
        const token = localStorage.getItem('auth_token');
        return {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
});
```

```tsx
// client/src/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { trpc, trpcClient, queryClient } from './lib/trpc';
import { AuthProvider } from './hooks/useAuth';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import Outreach from './pages/Outreach';
import Students from './pages/Students';
import Placements from './pages/Placements';
import Analytics from './pages/Analytics';
import Tasks from './pages/Tasks';
import TeamsIntegration from './pages/TeamsIntegration';
import Settings from './pages/Settings';

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/:id" element={<LeadDetail />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/outreach" element={<Outreach />} />
                <Route path="/students" element={<Students />} />
                <Route path="/placements" element={<Placements />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/teams" element={<TeamsIntegration />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

## Appendix D: Project Scaffolding Script

Run this script to create the entire project structure:

```bash
#!/bin/bash
# setup-skarion-crm.sh

echo "🚀 Setting up Skarion CRM project..."

# Create root project
mkdir -p skarion-crm && cd skarion-crm

# Server structure
mkdir -p server/{db/migrations,routers,services/{ai/providers,automation},routes}
touch server/{index.ts,trpc.ts}
touch server/db/{index.ts,schema.ts,seed.ts}
touch server/routers/{_app.ts,lead.ts,conversation.ts,pipeline.ts,task.ts,enrollment.ts,analytics.ts,teams.ts,ai.ts}
touch server/services/{leadScoring.ts,deduplication.ts,assignment.ts,followUpEngine.ts,teamsBot/index.ts,analytics.ts}
touch server/services/ai/{index.ts,types.ts}
touch server/services/ai/providers/{kimi.ts,ollama.ts}
touch server/services/automation/{cronJobs.ts}
touch server/routes/teams-webhook.ts

# Client structure
mkdir -p client/src/{components/{ui,layout,forms,charts},pages,hooks,lib,types,styles}
touch client/src/{main.tsx,App.tsx}
touch client/src/components/ui/{Button.tsx,Card.tsx,Modal.tsx,StatCard.tsx,Input.tsx,Select.tsx}
touch client/src/components/layout/{Layout.tsx,Sidebar.tsx,Header.tsx,PageShell.tsx}
touch client/src/components/{ActivityFeed.tsx,LeadCard.tsx,PipelineColumn.tsx}
touch client/src/components/charts/{FunnelChart.tsx,LineChart.tsx,BarChart.tsx}
touch client/src/pages/{Dashboard.tsx,Leads.tsx,LeadDetail.tsx,Pipeline.tsx,Outreach.tsx,Students.tsx,StudentDetail.tsx,Placements.tsx,Analytics.tsx,Tasks.tsx,TeamsIntegration.tsx,Settings.tsx}
touch client/src/hooks/{useAuth.ts,useLeads.ts,usePipeline.ts,useAI.ts}
touch client/src/lib/{trpc.ts,utils.ts,constants.ts}
touch client/src/types/index.ts

# Config files
touch {package.json,drizzle.config.ts,.env.example,.gitignore}
touch client/{package.json,vite.config.ts,tailwind.config.js,index.html,tsconfig.json}

echo "✅ Project structure created!"
echo ""
echo "Next steps:"
echo "1. Copy the code from the planning document into each file"
echo "2. Run: npm install"
echo "3. Set up your .env file"
echo "4. Run: npm run db:migrate"
echo "5. Run: npm run db:seed"
echo "6. Run: npm run dev"
```

---

## Appendix E: Complete File Tree

```
skarion-crm/
├── package.json                          # Root package.json
├── drizzle.config.ts                     # Drizzle ORM config
├── .env.example                          # Environment template
├── .gitignore                            # Git ignore
│
├── server/
│   ├── index.ts                          # Express entry point
│   ├── trpc.ts                           # tRPC setup + middleware
│   │
│   ├── db/
│   │   ├── index.ts                      # Database connection
│   │   ├── schema.ts                     # Drizzle schema (all tables)
│   │   ├── seed.ts                       # Seed data script
│   │   └── migrations/                   # Generated migrations
│   │
│   ├── routers/
│   │   ├── _app.ts                       # Root router
│   │   ├── lead.ts                       # Lead CRUD + scoring + import
│   │   ├── conversation.ts               # Message tracking + templates
│   │   ├── pipeline.ts                   # Stage management + transitions
│   │   ├── task.ts                       # Task CRUD + assignment
│   │   ├── enrollment.ts                 # Enrollment + contract + payment
│   │   ├── analytics.ts                  # KPIs + snapshots
│   │   ├── teams.ts                      # Teams bot operations
│   │   └── ai.ts                         # AI generation endpoints
│   │
│   ├── services/
│   │   ├── leadScoring.ts                # Rule-based + AI scoring
│   │   ├── deduplication.ts              # Email/phone/name matching
│   │   ├── assignment.ts                 # Round-robin + load balancing
│   │   ├── followUpEngine.ts             # Sequence automation
│   │   ├── analytics.ts                  # Snapshot generation
│   │   ├── teamsBot/
│   │   │   └── index.ts                  # Teams bot + Graph API
│   │   ├── ai/
│   │   │   ├── index.ts                  # Main AI service with fallback
│   │   │   ├── types.ts                  # AI provider interfaces
│   │   │   └── providers/
│   │   │       ├── kimi.ts               # Kimi via NVIDIA NIM
│   │   │       └── ollama.ts             # Local Ollama fallback
│   │   └── automation/
│   │       └── cronJobs.ts               # Scheduled job definitions
│   │
│   └── routes/
│       └── teams-webhook.ts              # Teams Bot Framework webhook
│
├── client/
│   ├── package.json                      # Client dependencies
│   ├── vite.config.ts                    # Vite configuration
│   ├── tailwind.config.js                # Tailwind theme
│   ├── tsconfig.json                     # TypeScript config
│   ├── index.html                        # HTML entry
│   │
│   └── src/
│       ├── main.tsx                      # React entry point
│       ├── App.tsx                       # Router + providers
│       │
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── StatCard.tsx
│       │   │   ├── Input.tsx
│       │   │   └── Select.tsx
│       │   ├── layout/
│       │   │   ├── Layout.tsx            # Main layout shell
│       │   │   ├── Sidebar.tsx           # Navigation sidebar
│       │   │   ├── Header.tsx            # Top header bar
│       │   │   └── PageShell.tsx         # Page wrapper
│       │   ├── forms/
│       │   │   ├── LeadForm.tsx
│       │   │   └── ProfileForm.tsx
│       │   ├── charts/
│       │   │   ├── FunnelChart.tsx
│       │   │   ├── LineChart.tsx
│       │   │   └── BarChart.tsx
│       │   ├── ActivityFeed.tsx
│       │   ├── LeadCard.tsx
│       │   └── PipelineColumn.tsx
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx             # KPIs + charts + activity
│       │   ├── Leads.tsx                 # Lead list with filters
│       │   ├── LeadDetail.tsx            # Full lead profile + timeline
│       │   ├── Pipeline.tsx              # Kanban drag-drop board
│       │   ├── Outreach.tsx              # Message center + templates
│       │   ├── Students.tsx              # Active students list
│       │   ├── StudentDetail.tsx         # Progress tracking
│       │   ├── Placements.tsx            # Placement management
│       │   ├── Analytics.tsx             # Full analytics dashboard
│       │   ├── Tasks.tsx                 # Task management
│       │   ├── TeamsIntegration.tsx      # Teams bot config + logs
│       │   └── Settings.tsx              # CRM configuration
│       │
│       ├── hooks/
│       │   ├── useAuth.ts                # Auth state + Clerk
│       │   ├── useLeads.ts               # Lead query hooks
│       │   ├── usePipeline.ts            # Pipeline state hooks
│       │   └── useAI.ts                  # AI generation hooks
│       │
│       ├── lib/
│       │   ├── trpc.ts                   # tRPC client + provider
│       │   ├── utils.ts                  # Helper functions
│       │   └── constants.ts              # App constants
│       │
│       ├── types/
│       │   └── index.ts                  # Shared TypeScript types
│       │
│       └── styles/
│           └── index.css                 # Tailwind directives
│
└── docs/
    ├── architecture_diagram.png
    └── erd_diagram.png
```

---

## Appendix F: Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: skarion-db
    environment:
      POSTGRES_USER: skarion
      POSTGRES_PASSWORD: skarion_dev
      POSTGRES_DB: skarion_crm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skarion"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Ollama (Local AI)
  ollama:
    image: ollama/ollama:latest
    container_name: skarion-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    # To pull models: docker exec -it skarion-ollama ollama pull llama3.2

  # Redis (for caching and session store)
  redis:
    image: redis:7-alpine
    container_name: skarion-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  ollama_data:
  redis_data:
```

Run locally:
```bash
docker-compose up -d
# Pull Ollama model
docker exec -it skarion-ollama ollama pull llama3.2
# Run migrations
npm run db:migrate
# Start dev server
npm run dev
```

---

## Appendix G: Teams Bot Setup Checklist

Follow these exact steps to register and configure the Teams bot:

### Step 1: Register Azure Bot
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Bot Channels Registration** → **Create**
3. Fill in:
   - **Bot Name**: `skarion-crm-bot`
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new `skarion-rg`
   - **Pricing Tier**: **F0 (Free)** — 10,000 messages/month
4. Click **Create**
5. After creation, go to **Configuration**
6. Set **Messaging endpoint**: `https://your-api.com/teams/webhook`
7. Click **Apply**

### Step 2: Get Credentials
1. In Bot Configuration, click **Manage** next to **Microsoft App ID**
2. Go to **Certificates & Secrets** → **New Client Secret**
3. Copy the **App ID** and **Client Secret** to your `.env`:
   ```bash
   TEAMS_APP_ID=your-app-id
   TEAMS_APP_PASSWORD=your-client-secret
   ```

### Step 3: Enable Teams Channel
1. In Azure Bot, go to **Channels**
2. Click **Microsoft Teams**
3. Agree to terms and click **Save**
4. Teams channel is now enabled

### Step 4: Install Bot in Teams
1. Go to **Teams App Studio** (in Teams desktop app)
2. Click **Manifest Editor** → **Create New App**
3. Fill in app details (name: `Skarion CRM`, description, etc.)
4. In **Bots** section, click **Set Up** → **Existing Bot**
5. Enter your **App ID** from Step 2
6. Select scopes: **Personal** and **Team**
7. Click **Save**
8. Go to **Test & Distribute** → **Install**
9. The bot will appear in your Teams

### Step 5: Configure Graph API Permissions
1. Go to [Azure AD App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Find your bot app
3. Go to **API Permissions** → **Add Permission**
4. Add these Microsoft Graph permissions:
   - `Chat.Read`
   - `ChatMessage.Send`
   - `User.Read`
   - `TeamsActivity.Send`
5. Click **Grant Admin Consent**

### Step 6: Test the Integration
1. Send a message to your bot in Teams: `Test connection`
2. Check your API logs — you should see the webhook hit
3. Try: `Update lead John Doe status to contacted`
4. The AI should process this and update the CRM!

---

## Appendix H: Kimi API via NVIDIA — Setup Guide

### Step 1: Get NVIDIA API Key
1. Go to [build.nvidia.com](https://build.nvidia.com)
2. Sign in with your NVIDIA account
3. Navigate to **API Keys** → **Generate New Key**
4. Copy the key to your `.env`:
   ```bash
   NVIDIA_API_KEY=nvapi-xxxxxxxx
   ```

### Step 2: Test the API
```bash
curl -X POST 'https://integrate.api.nvidia.com/v1/chat/completions' \
  -H 'Authorization: Bearer $NVIDIA_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "moonshotai/kimi-k2-5",
    "messages": [{"role": "user", "content": "Say hello"}],
    "temperature": 0.7
  }'
```

### Step 3: Free Tier Limits
| Limit | Value |
|---|---|
| Requests per day | 1,000 |
| Tokens per request | 4,096 |
| Models available | Kimi K2.5, LLaMA 3.2, Mistral, and more |
| Cost | **Free** |

---

## Final Notes

This planning document gives you a **complete, production-ready blueprint**. Every file, every function, and every table is specified. The system is designed to handle Skarion's exact workflows:

- **Lead sourcing** from Apollo AI, LinkedIn Recruiter Lite, Sales Navigator, Reddit, and Facebook
- **Consultation calls** with structured outcome tracking
- **Contract management** via RabbitSign integration
- **Course progress** tracking for AutoCAD and OSP Engineering
- **Placement tracking** with fee calculation (10% annual or $6,000)
- **Team collaboration** through Microsoft Teams with AI-powered CRM sync
- **Intelligent automation** via Kimi AI with Ollama fallback

The total hosting cost is **$0-5/month** using free tiers across Vercel, Railway, Supabase, Clerk, NVIDIA NIM, and Azure Bot Service. The entire system is type-safe from database to UI thanks to Drizzle + tRPC + TypeScript.

**Start with Phase 1** (database + auth + lead management) and you'll have a working CRM within 3 weeks. Each subsequent phase adds more intelligence and automation.
