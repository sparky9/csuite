-- Proposal & Contract Agent Database Schema
-- Run via npm run db:setup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS proposal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  category VARCHAR(60),
  body TEXT NOT NULL,
  required_tokens TEXT[] DEFAULT '{}',
  optional_tokens TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_user_name
  ON proposal_templates (user_id, LOWER(name));

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  template_id UUID REFERENCES proposal_templates(id) ON DELETE SET NULL,
  proposal_number VARCHAR(40) NOT NULL,
  client_name VARCHAR(120) NOT NULL,
  client_company VARCHAR(120),
  client_email VARCHAR(160),
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  currency VARCHAR(8) DEFAULT 'USD',
  subtotal NUMERIC(12,2),
  discount NUMERIC(12,2),
  tax NUMERIC(12,2),
  total NUMERIC(12,2),
  summary TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::JSONB,
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_user_status ON proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_number ON proposals(proposal_number);

CREATE TABLE IF NOT EXISTS proposal_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  position INT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
  contract_number VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  signature_deadline DATE,
  body TEXT NOT NULL,
  envelope_metadata JSONB DEFAULT '{}'::JSONB,
  sent_at TIMESTAMP,
  signed_at TIMESTAMP,
  countersigned_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);

CREATE TABLE IF NOT EXISTS signature_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  description TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signature_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  role VARCHAR(40) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  signed_at TIMESTAMP,
  reminder_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  file_name VARCHAR(180) NOT NULL,
  file_type VARCHAR(60),
  storage_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed starter template
INSERT INTO proposal_templates (name, description, category, body, required_tokens, optional_tokens)
VALUES (
  'Consulting Proposal',
  'Standard consulting engagement proposal',
  'consulting',
  '## Proposal for {{client_name}}\n\n**Project Summary**\n{{project_summary}}\n\n**Scope**\n{{scope_outline}}\n\n**Investment**\nTotal: {{total_value}} {{currency}}\n\nPrepared by {{sender_name}} on {{proposal_date}}',
  ARRAY['client_name', 'project_summary', 'scope_outline', 'total_value', 'currency', 'sender_name', 'proposal_date'],
  ARRAY['team_introduction', 'timeline_notes']
)
ON CONFLICT DO NOTHING;
