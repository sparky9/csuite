-- Retention & Renewal Agent Schema
-- Provides tables for tracking renewal cycles, health signals, and playbooks

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS renewal_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_account_id TEXT,
  account_name TEXT NOT NULL,
  customer_segment TEXT,
  owner_id TEXT,
  owner_name TEXT,
  contract_value NUMERIC,
  renewal_date DATE,
  renewal_term TEXT,
  renewal_probability NUMERIC,
  risk_level TEXT DEFAULT 'healthy',
  health_score NUMERIC,
  status TEXT DEFAULT 'active',
  churn_reason TEXT,
  metrics_snapshot JSONB DEFAULT '{}'::JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_accounts_owner ON renewal_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_accounts_renewal_date ON renewal_accounts(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_accounts_risk_level ON renewal_accounts(risk_level);

CREATE TABLE IF NOT EXISTS renewal_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES renewal_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_score NUMERIC,
  support_score NUMERIC,
  sentiment_score NUMERIC,
  financial_score NUMERIC,
  composite_score NUMERIC,
  signal_breakdown JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_account ON renewal_health_snapshots(account_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS renewal_playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES renewal_accounts(id) ON DELETE CASCADE,
  playbook_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  key_objectives TEXT,
  recommended_actions JSONB DEFAULT '[]'::JSONB,
  supporting_assets JSONB DEFAULT '[]'::JSONB,
  generated_by TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_renewal_playbooks_account ON renewal_playbooks(account_id);
CREATE INDEX IF NOT EXISTS idx_renewal_playbooks_type ON renewal_playbooks(playbook_type);

CREATE TABLE IF NOT EXISTS renewal_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playbook_id UUID REFERENCES renewal_playbooks(id) ON DELETE SET NULL,
  account_id UUID REFERENCES renewal_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  owner_name TEXT,
  due_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_renewal_tasks_account ON renewal_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_renewal_tasks_owner ON renewal_tasks(owner_id);

CREATE TABLE IF NOT EXISTS renewal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES renewal_accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_events_account ON renewal_events(account_id);
CREATE INDEX IF NOT EXISTS idx_renewal_events_type ON renewal_events(event_type, occurred_at DESC);
