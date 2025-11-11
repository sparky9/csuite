-- VPA Core Database Schema
-- Multi-tenant architecture for VPA (Virtual Personal Assistant)
-- Version: 1.0.0

-- ============================================
-- USER MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  license_key VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
  metadata JSONB DEFAULT '{}' -- Store preferences, settings
);

CREATE INDEX idx_users_license_key ON users(license_key);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- SUBSCRIPTION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  plan_name VARCHAR(100) NOT NULL, -- 'vpa-core-only', 'vpa-plus-prospects', etc.
  modules TEXT[] NOT NULL, -- ['vpa-core', 'lead-tracker', 'prospect-finder', 'email-orchestrator']
  price_monthly INTEGER NOT NULL, -- in cents: 9900 = $99.00
  status VARCHAR(50) DEFAULT 'active', -- active, past_due, cancelled, trialing
  trial_end TIMESTAMP,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period ON user_subscriptions(current_period_end);
CREATE INDEX idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

-- ============================================
-- USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS user_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  module_id VARCHAR(100) NOT NULL, -- 'prospect-finder', 'lead-tracker', etc.
  tool_name VARCHAR(100) NOT NULL, -- 'search_companies', 'add_prospect', etc.
  command_text TEXT, -- Original user command (for analytics)
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- Results count, parameters, etc.
);

CREATE INDEX idx_user_usage_user_module ON user_usage(user_id, module_id, timestamp DESC);
CREATE INDEX idx_user_usage_timestamp ON user_usage(timestamp DESC);
CREATE INDEX idx_user_usage_module ON user_usage(module_id);
CREATE INDEX idx_user_usage_success ON user_usage(success);

-- ============================================
-- MODULE CONFIGURATIONS (per-user settings)
-- ============================================

CREATE TABLE IF NOT EXISTS user_module_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  module_id VARCHAR(100) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_id, config_key)
);

CREATE INDEX idx_user_module_config_user ON user_module_config(user_id, module_id);

-- ============================================
-- RESEARCH & INSIGHTS MODULE
-- ============================================

CREATE TABLE IF NOT EXISTS research_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  url TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'competitor',
  frequency VARCHAR(50),
  notes TEXT,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_sources_user_url ON research_sources(user_id, url);
CREATE INDEX IF NOT EXISTS idx_research_sources_user ON research_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_category ON research_sources(category);

CREATE TABLE IF NOT EXISTS research_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES research_sources(source_id) ON DELETE CASCADE,
  captured_at TIMESTAMP DEFAULT NOW(),
  content_hash VARCHAR(64) NOT NULL,
  title TEXT,
  summary TEXT,
  highlights TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_research_snapshots_source ON research_snapshots(source_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_snapshots_hash ON research_snapshots(content_hash);

-- ============================================
-- MULTI-TENANT SUPPORT FOR EXISTING TABLES
-- ============================================
-- These migrations add user_id to existing module tables
-- Run these after setting up VPA Core tables

-- Note: These ALTER TABLE statements are idempotent-safe
-- They check if column exists before adding

-- Companies table (ProspectFinder)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN user_id UUID REFERENCES users(user_id);
    CREATE INDEX idx_companies_user ON companies(user_id);
  END IF;
END $$;

-- Prospects table (LeadTracker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE prospects ADD COLUMN user_id UUID REFERENCES users(user_id);
    CREATE INDEX idx_prospects_user ON prospects(user_id);
  END IF;
END $$;

-- Campaigns table (EmailOrchestrator)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN user_id UUID REFERENCES users(user_id);
    CREATE INDEX idx_campaigns_user ON campaigns(user_id);
  END IF;
END $$;

-- Contacts table (LeadTracker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN user_id UUID REFERENCES users(user_id);
    CREATE INDEX idx_contacts_user ON contacts(user_id);
  END IF;
END $$;

-- Activities table (LeadTracker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN user_id UUID REFERENCES users(user_id);
    CREATE INDEX idx_activities_user ON activities(user_id);
  END IF;
END $$;

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Active subscriptions view
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
  u.user_id,
  u.email,
  u.name,
  s.plan_name,
  s.modules,
  s.status,
  s.current_period_end
FROM users u
JOIN user_subscriptions s ON u.user_id = s.user_id
WHERE u.status = 'active'
  AND s.status = 'active'
  AND s.current_period_end > NOW();

-- Usage analytics view (last 30 days)
CREATE OR REPLACE VIEW usage_stats_30d AS
SELECT
  u.user_id,
  u.email,
  uu.module_id,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE uu.success = false) as error_count,
  AVG(uu.execution_time_ms) as avg_execution_time_ms
FROM users u
JOIN user_usage uu ON u.user_id = uu.user_id
WHERE uu.timestamp > NOW() - INTERVAL '30 days'
GROUP BY u.user_id, u.email, uu.module_id;

-- ============================================
-- SEED DATA (for development/testing)
-- ============================================

-- Insert a test user (only if not exists)
INSERT INTO users (email, name, license_key, status)
VALUES (
  'test@example.com',
  'Test User',
  'test-license-key-12345',
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- Insert test subscription (only if not exists)
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  SELECT user_id INTO test_user_id FROM users WHERE email = 'test@example.com';

  IF test_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions WHERE user_id = test_user_id
  ) THEN
    INSERT INTO user_subscriptions (
      user_id,
      plan_name,
      modules,
      price_monthly,
      status,
      current_period_start,
      current_period_end
    ) VALUES (
      test_user_id,
      'vpa-bundle',
      ARRAY['vpa-core', 'lead-tracker', 'prospect-finder', 'email-orchestrator'],
      9900,
      'active',
      NOW(),
      NOW() + INTERVAL '30 days'
    );
  END IF;
END $$;

-- ============================================
-- SCHEMA VERSION TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS schema_versions (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_versions (version, description)
VALUES
  ('1.0.0', 'Initial VPA Core schema with multi-tenant support'),
  ('1.1.0', 'Add Research & Insights module tables')
ON CONFLICT (version) DO NOTHING;
