-- Enhancement #7: Client-Onboarding-Agent Write Operations
-- Migration: Add step completion tracking and intake responses table
-- Apply with: psql $DATABASE_URL -f src/db/migration-001-write-ops.sql

-- Add completion tracking to plan steps
ALTER TABLE onboarding_plan_steps
  ADD COLUMN IF NOT EXISTS completed_by TEXT,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Create intake responses table
CREATE TABLE IF NOT EXISTS intake_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_responses_request
  ON intake_responses(intake_request_id);

CREATE INDEX IF NOT EXISTS idx_intake_responses_user
  ON intake_responses(user_id);

-- Update intake_requests table to track submission
ALTER TABLE intake_requests
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by TEXT;

COMMENT ON COLUMN onboarding_plan_steps.completed_by IS 'User who completed the step (email or user_id)';
COMMENT ON COLUMN onboarding_plan_steps.completion_notes IS 'Optional notes about how the step was completed';
COMMENT ON TABLE intake_responses IS 'Individual field responses for intake requests';
COMMENT ON COLUMN intake_requests.submitted_at IS 'When the intake form was fully submitted';
COMMENT ON COLUMN intake_requests.submitted_by IS 'User who submitted the intake response';
