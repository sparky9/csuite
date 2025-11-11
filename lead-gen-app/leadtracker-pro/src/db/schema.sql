-- LeadTracker Pro Database Schema
-- PostgreSQL schema for MCP-native CRM
-- Uses same Neon database as ProspectFinder MCP

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROSPECTS TABLE
-- Core tracking table for B2B leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255), -- Multi-user support (license key or user identifier)

  -- Company information
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(10),
  zip_code VARCHAR(20),

  -- Pipeline tracking
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  source VARCHAR(100), -- 'Yellow Pages', 'Google Maps', 'Referral', etc.
  tags TEXT[] DEFAULT '{}', -- ['HVAC', 'High Priority']
  health_score INT,
  health_level VARCHAR(20),
  last_interaction_date DATE,
  sentiment_trend VARCHAR(50),

  -- Deal tracking
  deal_value DECIMAL(10,2),
  probability INT CHECK (probability >= 0 AND probability <= 100),

  -- Metadata
  prospect_finder_company_id UUID, -- Link to ProspectFinder companies table
  added_at TIMESTAMP DEFAULT NOW(),
  last_contacted_at TIMESTAMP,
  next_follow_up TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS health_score INT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS health_level VARCHAR(20);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_interaction_date DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS sentiment_trend VARCHAR(50);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_user_status ON prospects(user_id, status); -- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_prospects_next_follow_up ON prospects(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_tags ON prospects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_prospects_city_state ON prospects(city, state);
CREATE INDEX IF NOT EXISTS idx_prospects_company_name ON prospects(company_name);
CREATE INDEX IF NOT EXISTS idx_prospects_health ON prospects(health_score);
CREATE INDEX IF NOT EXISTS idx_prospects_last_interaction ON prospects(last_interaction_date);

-- ============================================================================
-- CONTACTS TABLE
-- Multiple contacts per company
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  user_id VARCHAR(255), -- Multi-user support

  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  linkedin_url VARCHAR(500),

  is_primary BOOLEAN DEFAULT FALSE, -- Primary contact for this prospect

  -- Metadata
  prospect_finder_decision_maker_id UUID, -- Link to ProspectFinder decision_makers

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_prospect_id ON contacts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON contacts(is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);

-- ============================================================================
-- ACTIVITIES TABLE
-- Call log, emails, notes, meetings
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id VARCHAR(255), -- Multi-user support

  activity_type VARCHAR(50) NOT NULL, -- 'call', 'email', 'meeting', 'note'
  activity_date TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Call-specific
  call_outcome VARCHAR(50), -- 'answered', 'voicemail', 'no_answer', 'wrong_number'
  call_duration_seconds INT,

  -- Content
  subject VARCHAR(500),
  notes TEXT,

  -- Follow-up
  requires_follow_up BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMP,

  -- Retention (configurable data retention)
  retention_months INT DEFAULT 12, -- Configurable: 3, 6, 12, 24, 60
  delete_after TIMESTAMP, -- Auto-calculated: activity_date + retention_months

  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_prospect_id ON activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_prospect ON activities(user_id, prospect_id, activity_date DESC); -- Composite index for prospect activity history
CREATE INDEX IF NOT EXISTS idx_activities_activity_date ON activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_delete_after ON activities(delete_after) WHERE delete_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);

-- ============================================================================
-- FOLLOW_UPS TABLE
-- Reminders and scheduled tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id VARCHAR(255), -- Multi-user support

  due_date TIMESTAMP NOT NULL,
  reminder_type VARCHAR(50), -- 'call', 'email', 'meeting'
  reminder_note TEXT,

  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  activity_id UUID REFERENCES activities(id), -- Link to activity that completed this

  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date) WHERE completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_follow_ups_prospect_id ON follow_ups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_completed ON follow_ups(completed);

-- ============================================================================
-- UPSELL OPPORTUNITIES TABLE
-- Tracks detected upsell/cross-sell suggestions per prospect
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsell_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  suggested_service TEXT NOT NULL,
  confidence NUMERIC(3,2),
  reasoning TEXT,
  estimated_value DECIMAL(10,2),
  status TEXT DEFAULT 'detected', -- detected, pitched, accepted, declined
  pitched_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_prospect ON upsell_opportunities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_status ON upsell_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_user ON upsell_opportunities(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_upsell_opportunities_unique ON upsell_opportunities(prospect_id, suggested_service);

-- ============================================================================
-- LEADTRACKER_CONFIG TABLE
-- System configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS leadtracker_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default configuration
INSERT INTO leadtracker_config (key, value, description) VALUES
  ('activity_retention_months', '12', 'Default activity retention period (3, 6, 12, 24, or 60 months)'),
  ('scoring_stage_weights', '{"new":6,"contacted":12,"qualified":18,"meeting_scheduled":26,"proposal_sent":32,"negotiating":38,"closed_won":0,"closed_lost":0,"on_hold":0}', 'Stage weights for next-action scoring'),
  ('scoring_deal_thresholds', '[{"threshold":25000,"weight":24},{"threshold":15000,"weight":20},{"threshold":10000,"weight":16},{"threshold":5000,"weight":12},{"threshold":2000,"weight":8},{"threshold":0,"weight":4}]', 'Deal value thresholds and weights for scoring'),
  ('scoring_priority_thresholds', '{"urgent":160,"high":120}', 'Score thresholds for priority classification (urgent, high, normal)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- VIEWS
-- Helpful views for common queries
-- ============================================================================

-- Pipeline summary by status
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  status,
  COUNT(*) as count,
  SUM(deal_value) as potential_revenue,
  AVG(deal_value) as avg_deal_value,
  SUM(CASE WHEN last_contacted_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as contacted_last_week
FROM prospects
GROUP BY status
ORDER BY
  CASE status
    WHEN 'new' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'meeting_scheduled' THEN 4
    WHEN 'proposal_sent' THEN 5
    WHEN 'negotiating' THEN 6
    WHEN 'closed_won' THEN 7
    WHEN 'closed_lost' THEN 8
    WHEN 'on_hold' THEN 9
    ELSE 10
  END;

-- Overdue follow-ups
CREATE OR REPLACE VIEW overdue_follow_ups AS
SELECT
  f.id,
  f.due_date,
  f.reminder_type,
  f.reminder_note,
  p.company_name,
  p.phone,
  p.status as prospect_status,
  c.full_name as contact_name,
  c.phone as contact_phone,
  c.email as contact_email,
  EXTRACT(DAY FROM NOW() - f.due_date) as days_overdue
FROM follow_ups f
JOIN prospects p ON f.prospect_id = p.id
LEFT JOIN contacts c ON f.contact_id = c.id
WHERE f.completed = FALSE
  AND f.due_date < NOW()
ORDER BY f.due_date ASC;

-- Activity summary (last 30 days)
CREATE OR REPLACE VIEW activity_summary AS
SELECT
  DATE(activity_date) as date,
  activity_type,
  COUNT(*) as count,
  COUNT(DISTINCT prospect_id) as unique_prospects,
  SUM(CASE WHEN call_outcome = 'answered' THEN 1 ELSE 0 END) as calls_answered,
  SUM(CASE WHEN call_outcome = 'voicemail' THEN 1 ELSE 0 END) as voicemails_left,
  AVG(call_duration_seconds) as avg_call_duration
FROM activities
WHERE activity_date >= NOW() - INTERVAL '30 days'
GROUP BY DATE(activity_date), activity_type
ORDER BY date DESC, activity_type;

-- Top prospects (by deal value and engagement)
CREATE OR REPLACE VIEW top_prospects AS
SELECT
  p.id,
  p.company_name,
  p.status,
  p.deal_value,
  p.probability,
  p.last_contacted_at,
  p.next_follow_up,
  COUNT(DISTINCT a.id) as activity_count,
  COUNT(DISTINCT c.id) as contact_count,
  MAX(a.activity_date) as last_activity
FROM prospects p
LEFT JOIN activities a ON p.id = a.prospect_id
LEFT JOIN contacts c ON p.id = c.prospect_id
WHERE p.status NOT IN ('closed_lost', 'on_hold')
GROUP BY p.id
ORDER BY
  (p.deal_value * p.probability / 100.0) DESC NULLS LAST,
  activity_count DESC
LIMIT 50;

-- ============================================================================
-- TRIGGERS
-- Automated updates
-- ============================================================================

-- Update updated_at timestamp on prospects
CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospects_updated_at ON prospects;
CREATE TRIGGER prospects_updated_at
BEFORE UPDATE ON prospects
FOR EACH ROW
EXECUTE FUNCTION update_prospects_updated_at();

-- Update updated_at timestamp on contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contacts_updated_at();

-- Auto-calculate delete_after date for activities
CREATE OR REPLACE FUNCTION calculate_activity_delete_after()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.retention_months IS NOT NULL THEN
    NEW.delete_after = NEW.activity_date + (NEW.retention_months || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_calculate_delete_after ON activities;
CREATE TRIGGER activity_calculate_delete_after
BEFORE INSERT OR UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION calculate_activity_delete_after();

-- Update last_contacted_at on prospects when activity logged
CREATE OR REPLACE FUNCTION update_prospect_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.activity_type IN ('call', 'email', 'meeting') THEN
    UPDATE prospects
    SET last_contacted_at = NEW.activity_date
    WHERE id = NEW.prospect_id
      AND (last_contacted_at IS NULL OR last_contacted_at < NEW.activity_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_update_last_contacted ON activities;
CREATE TRIGGER activity_update_last_contacted
AFTER INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION update_prospect_last_contacted();

-- Update updated_at timestamp on upsell opportunities
CREATE OR REPLACE FUNCTION update_upsell_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS upsell_opportunities_updated_at ON upsell_opportunities;
CREATE TRIGGER upsell_opportunities_updated_at
BEFORE UPDATE ON upsell_opportunities
FOR EACH ROW
EXECUTE FUNCTION update_upsell_opportunities_updated_at();

-- Schema created successfully
