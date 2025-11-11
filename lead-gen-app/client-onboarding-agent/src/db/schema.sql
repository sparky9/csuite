-- Client Onboarding Agent database schema
-- Apply with: npm run db:setup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  category VARCHAR(80),
  overview TEXT,
  timeline_days INT,
  stages JSONB NOT NULL,
  intake_requirements JSONB DEFAULT '[]'::JSONB,
  welcome_sequence JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_templates_user_name
  ON onboarding_templates (user_id, LOWER(name));

CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  template_id UUID REFERENCES onboarding_templates(id) ON DELETE SET NULL,
  client_name VARCHAR(140) NOT NULL,
  client_company VARCHAR(140),
  owner_name VARCHAR(140),
  status VARCHAR(40) NOT NULL DEFAULT 'not_started',
  kickoff_target DATE,
  progress NUMERIC(5,2) DEFAULT 0,
  summary TEXT,
  context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_plans_user_status ON onboarding_plans (user_id, status);

CREATE TABLE IF NOT EXISTS onboarding_plan_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  stage_order INT NOT NULL,
  step_order INT NOT NULL,
  stage_name VARCHAR(140) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  due_date DATE,
  assigned_to VARCHAR(140),
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP,
  completed_by TEXT,
  completion_notes TEXT,
  blocker_note TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_steps_plan ON onboarding_plan_steps(plan_id);

CREATE TABLE IF NOT EXISTS intake_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  request_type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  instructions TEXT,
  due_date DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  response_data JSONB,
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  reminder_count INT DEFAULT 0,
  last_reminded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_requests_plan ON intake_requests(plan_id);

CREATE TABLE IF NOT EXISTS intake_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_responses_request ON intake_responses(intake_request_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_user ON intake_responses(user_id);

CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  description TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed a starter onboarding template
INSERT INTO onboarding_templates (name, description, category, overview, timeline_days, stages, intake_requirements, welcome_sequence)
VALUES (
  'Standard Consulting Onboarding',
  'Kickoff sequence for new consulting engagements with discovery, access setup, and first deliverables.',
  'consulting',
  'Guides client from signed agreement to first value delivery, including access, discovery, and launch preparation.',
  14,
  '[
    {
      "name": "Discovery Setup",
      "description": "Gather context and schedule kickoff meeting.",
      "durationDays": 3,
      "tasks": [
        {"title": "Send welcome email", "description": "Send branded welcome note with what to expect", "dueAfterDays": 0, "assignedTo": "account_manager"},
        {"title": "Collect discovery questionnaire", "description": "Confirm intake responses before kickoff", "dueAfterDays": 2, "assignedTo": "client_success"},
        {"title": "Kickoff call scheduling", "description": "Coordinate mutual availability", "dueAfterDays": 3, "assignedTo": "client_success"}
      ]
    },
    {
      "name": "Access & Tools",
      "description": "Ensure all accounts and assets are provisioned.",
      "durationDays": 5,
      "tasks": [
        {"title": "Verify tool access", "description": "Confirm logins for analytics, CRM, and project hub", "dueAfterDays": 5, "assignedTo": "operations"},
        {"title": "Upload brand assets", "description": "Collect logos, guidelines, and templates", "dueAfterDays": 4, "assignedTo": "client"}
      ]
    },
    {
      "name": "First Value",
      "description": "Deliver the first milestone to build momentum.",
      "durationDays": 6,
      "tasks": [
        {"title": "Draft first milestone plan", "description": "Outline first sprint goals and deliverables", "dueAfterDays": 7, "assignedTo": "delivery_lead"},
        {"title": "Share progress update", "description": "Weekly recap email with next steps", "dueAfterDays": 10, "assignedTo": "account_manager"}
      ]
    }
  ]',
  '[
    {"title": "Discovery questionnaire", "instructions": "Complete the Notion intake form", "requestType": "form", "dueAfterDays": 2},
    {"title": "Brand assets", "instructions": "Upload logos and guidelines", "requestType": "files", "dueAfterDays": 4}
  ]',
  '[
    {"day": 0, "channel": "email", "subject": "Welcome aboard!", "summary": "Set expectations and share kickoff checklist."},
    {"day": 3, "channel": "email", "subject": "Kickoff reminder", "summary": "Send agenda and prep materials."},
    {"day": 7, "channel": "email", "subject": "First-week recap", "summary": "Celebrate quick wins and confirm next actions."}
  ]'
)
ON CONFLICT DO NOTHING;
