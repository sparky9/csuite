-- E-Signature Extension Schema
-- Adds PDF generation and signature tracking capabilities
-- Run after main schema.sql via: npm run db:setup

-- Store generated PDF documents
CREATE TABLE IF NOT EXISTS contract_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  document_type VARCHAR(40) NOT NULL DEFAULT 'pdf', -- 'pdf', 'html', 'markdown'
  storage_type VARCHAR(40) NOT NULL DEFAULT 'database', -- 'database', 'filesystem', 's3'
  file_name VARCHAR(180) NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(80) DEFAULT 'application/pdf',
  storage_path TEXT, -- filesystem path or S3 URL
  content_data BYTEA, -- for database storage
  checksum VARCHAR(64), -- SHA-256 hash for integrity
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_docs_contract ON contract_documents(contract_id);

-- Store signature tokens and signing sessions
CREATE TABLE IF NOT EXISTS signature_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES signature_contacts(id) ON DELETE CASCADE,
  token VARCHAR(120) NOT NULL UNIQUE, -- URL-safe token
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_tokens_token ON signature_tokens(token);
CREATE INDEX IF NOT EXISTS idx_signature_tokens_contract ON signature_tokens(contract_id);

-- Store captured signatures (images, typed text, drawn canvas)
CREATE TABLE IF NOT EXISTS signature_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES signature_contacts(id) ON DELETE CASCADE,
  signature_type VARCHAR(40) NOT NULL, -- 'typed', 'drawn', 'uploaded', 'digital'
  signature_format VARCHAR(40), -- 'png', 'svg', 'base64'
  signature_data TEXT NOT NULL, -- base64 encoded image or SVG path
  font_family VARCHAR(80), -- for typed signatures
  width INT,
  height INT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_data_contact ON signature_data(contact_id);

-- Audit trail for signature events
CREATE TABLE IF NOT EXISTS signature_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES signature_contacts(id) ON DELETE SET NULL,
  token_id UUID REFERENCES signature_tokens(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL, -- 'link_generated', 'link_accessed', 'signature_started', 'signature_completed', 'document_downloaded', 'reminder_sent'
  event_data JSONB DEFAULT '{}'::JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sig_audit_contract ON signature_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_sig_audit_event ON signature_audit_log(event_type, created_at);

-- Email verification codes for signer authentication
CREATE TABLE IF NOT EXISTS signature_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES signature_contacts(id) ON DELETE CASCADE,
  verification_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sig_verif_contact ON signature_verifications(contact_id);
