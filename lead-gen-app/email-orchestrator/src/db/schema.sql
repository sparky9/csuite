-- EmailOrchestrator Database Schema
-- Integrates with ProspectFinder and LeadTracker Pro
-- Multi-touch campaigns, AI personalization, Gmail automation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',

  -- Target audience
  target_prospect_ids UUID[],
  target_tags TEXT[],
  target_status VARCHAR(50),
  target_search_query TEXT,

  -- Sending configuration
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  send_days_of_week INT[] DEFAULT '{1,2,3,4,5}',
  send_hours_start INT DEFAULT 9,
  send_hours_end INT DEFAULT 17,
  send_timezone VARCHAR(50) DEFAULT 'America/Chicago',

  -- Tracking
  tracking_enabled BOOLEAN DEFAULT TRUE,

  -- Cached statistics
  total_prospects INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_delivered INT DEFAULT 0,
  emails_bounced INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  emails_replied INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_target_tags ON campaigns USING GIN(target_tags);

-- ============================================================================
-- EMAIL TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,

  subject_line TEXT NOT NULL,
  body_template TEXT NOT NULL,

  personalization_instructions TEXT,
  use_ai_enhancement BOOLEAN DEFAULT TRUE,

  -- Performance metrics
  times_used INT DEFAULT 0,
  avg_open_rate DECIMAL(5,2),
  avg_reply_rate DECIMAL(5,2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_templates_category ON email_templates(category);

-- ============================================================================
-- EMAIL SEQUENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  sequence_order INT NOT NULL,
  day_offset INT NOT NULL,

  template_id UUID REFERENCES email_templates(id),
  subject_line TEXT NOT NULL,
  subject_variants TEXT[],
  body_template TEXT NOT NULL,

  personalization_instructions TEXT,
  use_ai_enhancement BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sequences_campaign_id ON email_sequences(campaign_id);
CREATE INDEX idx_email_sequences_order ON email_sequences(campaign_id, sequence_order);

-- ============================================================================
-- SENT EMAILS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sent_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL,
  prospect_id UUID,
  contact_id UUID,

  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),

  subject_line TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,

  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,

  provider VARCHAR(50) DEFAULT 'gmail',
  provider_message_id TEXT,

  error_message TEXT,
  bounce_reason VARCHAR(255),

  tracking_pixel_id VARCHAR(100),
  tracking_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sent_emails_campaign_id ON sent_emails(campaign_id);
CREATE INDEX idx_sent_emails_prospect_id ON sent_emails(prospect_id);
CREATE INDEX idx_sent_emails_status ON sent_emails(status);
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);
CREATE INDEX idx_sent_emails_to_email ON sent_emails(to_email);

-- ============================================================================
-- EMAIL TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_email_id UUID REFERENCES sent_emails(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,

  ip_address VARCHAR(50),
  user_agent TEXT,
  clicked_url TEXT,

  occurred_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_tracking_sent_email_id ON email_tracking(sent_email_id);
CREATE INDEX idx_email_tracking_event_type ON email_tracking(event_type);
CREATE INDEX idx_email_tracking_occurred_at ON email_tracking(occurred_at DESC);

-- ============================================================================
-- CAMPAIGN PROSPECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL,

  current_sequence_order INT DEFAULT 0,
  next_send_at TIMESTAMP,

  status VARCHAR(50) DEFAULT 'active',
  paused_reason TEXT,

  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMP,

  enrolled_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
CREATE INDEX idx_campaign_prospects_prospect_id ON campaign_prospects(prospect_id);
CREATE INDEX idx_campaign_prospects_next_send_at ON campaign_prospects(next_send_at) WHERE status = 'active';
CREATE INDEX idx_campaign_prospects_status ON campaign_prospects(status);

-- ============================================================================
-- UNSUBSCRIBES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS unsubscribes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,

  unsubscribed_at TIMESTAMP DEFAULT NOW(),
  unsubscribe_reason TEXT,

  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  sent_email_id UUID REFERENCES sent_emails(id) ON DELETE SET NULL
);

CREATE INDEX idx_unsubscribes_email ON unsubscribes(email);

-- ============================================================================
-- EMAIL CONFIG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO email_config (key, value, description) VALUES
  ('gmail_daily_limit', '500', 'Max emails per day via Gmail'),
  ('gmail_hourly_limit', '50', 'Max emails per hour via Gmail'),
  ('smtp_daily_limit', '1000', 'Max emails per day via SMTP'),
  ('smtp_hourly_limit', '200', 'Max emails per hour via SMTP'),
  ('company_name', 'Your Company Name', 'Company name for email footer'),
  ('company_address', '123 Main St, City, ST 12345', 'Physical address (CAN-SPAM required)'),
  ('company_phone', '+1-555-555-5555', 'Company phone number'),
  ('reply_to_email', '', 'Reply-to address (optional)'),
  ('gmail_access_token', '', 'Gmail OAuth access token (encrypted)'),
  ('gmail_refresh_token', '', 'Gmail OAuth refresh token (encrypted)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Campaign Performance View
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id,
  c.name,
  c.status,
  c.total_prospects,
  c.emails_sent,
  c.emails_delivered,
  c.emails_bounced,
  c.emails_opened,
  c.emails_clicked,
  c.emails_replied,
  CASE WHEN c.emails_delivered > 0
    THEN ROUND((c.emails_opened::DECIMAL / c.emails_delivered * 100), 2)
    ELSE 0
  END as open_rate,
  CASE WHEN c.emails_delivered > 0
    THEN ROUND((c.emails_clicked::DECIMAL / c.emails_delivered * 100), 2)
    ELSE 0
  END as click_rate,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.emails_replied::DECIMAL / c.emails_sent * 100), 2)
    ELSE 0
  END as reply_rate,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.emails_bounced::DECIMAL / c.emails_sent * 100), 2)
    ELSE 0
  END as bounce_rate,
  c.created_at,
  c.started_at,
  c.completed_at
FROM campaigns c;

-- Pending Sends View
CREATE OR REPLACE VIEW pending_sends AS
SELECT
  cp.id as campaign_prospect_id,
  cp.campaign_id,
  cp.prospect_id,
  cp.current_sequence_order,
  cp.next_send_at,
  c.name as campaign_name,
  c.from_email,
  c.from_name,
  c.tracking_enabled,
  es.id as sequence_id,
  es.subject_line,
  es.subject_variants,
  es.body_template,
  es.personalization_instructions,
  es.use_ai_enhancement
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
JOIN email_sequences es ON (
  es.campaign_id = cp.campaign_id
  AND es.sequence_order = cp.current_sequence_order + 1
)
WHERE cp.status = 'active'
  AND c.status = 'active'
  AND cp.next_send_at <= NOW()
ORDER BY cp.next_send_at ASC;

-- Email Activity Timeline View
CREATE OR REPLACE VIEW email_activity_timeline AS
SELECT
  se.id as sent_email_id,
  se.campaign_id,
  se.prospect_id,
  se.to_email,
  se.subject_line,
  se.sent_at,
  se.status,
  et.event_type,
  et.occurred_at as event_occurred_at,
  et.clicked_url,
  cp.current_sequence_order
FROM sent_emails se
LEFT JOIN email_tracking et ON et.sent_email_id = se.id
LEFT JOIN campaign_prospects cp ON (
  cp.campaign_id = se.campaign_id
  AND cp.prospect_id = se.prospect_id
)
WHERE se.sent_at IS NOT NULL
ORDER BY se.sent_at DESC, et.occurred_at DESC;

-- Template Performance View
CREATE OR REPLACE VIEW template_performance AS
SELECT
  t.id,
  t.name,
  t.category,
  t.times_used,
  COUNT(DISTINCT se.id) as actual_sends,
  COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN et.sent_email_id END) as opens,
  COUNT(DISTINCT CASE WHEN et.event_type = 'click' THEN et.sent_email_id END) as clicks,
  COUNT(DISTINCT CASE WHEN cp.replied = TRUE THEN se.id END) as replies,
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND((COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN et.sent_email_id END)::DECIMAL / COUNT(DISTINCT se.id) * 100), 2)
    ELSE 0
  END as calculated_open_rate,
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND((COUNT(DISTINCT CASE WHEN cp.replied = TRUE THEN se.id END)::DECIMAL / COUNT(DISTINCT se.id) * 100), 2)
    ELSE 0
  END as calculated_reply_rate
FROM email_templates t
LEFT JOIN email_sequences es ON es.template_id = t.id
LEFT JOIN sent_emails se ON se.sequence_id = es.id
LEFT JOIN email_tracking et ON et.sent_email_id = se.id
LEFT JOIN campaign_prospects cp ON (
  cp.campaign_id = se.campaign_id
  AND cp.prospect_id = se.prospect_id
)
GROUP BY t.id, t.name, t.category, t.times_used;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET
    total_prospects = (
      SELECT COUNT(*) FROM campaign_prospects
      WHERE campaign_id = p_campaign_id
    ),
    emails_sent = (
      SELECT COUNT(*) FROM sent_emails
      WHERE campaign_id = p_campaign_id AND sent_at IS NOT NULL
    ),
    emails_delivered = (
      SELECT COUNT(*) FROM sent_emails
      WHERE campaign_id = p_campaign_id AND status = 'delivered'
    ),
    emails_bounced = (
      SELECT COUNT(*) FROM sent_emails
      WHERE campaign_id = p_campaign_id AND status = 'bounced'
    ),
    emails_opened = (
      SELECT COUNT(DISTINCT se.id)
      FROM sent_emails se
      JOIN email_tracking et ON et.sent_email_id = se.id
      WHERE se.campaign_id = p_campaign_id AND et.event_type = 'open'
    ),
    emails_clicked = (
      SELECT COUNT(DISTINCT se.id)
      FROM sent_emails se
      JOIN email_tracking et ON et.sent_email_id = se.id
      WHERE se.campaign_id = p_campaign_id AND et.event_type = 'click'
    ),
    emails_replied = (
      SELECT COUNT(*) FROM campaign_prospects
      WHERE campaign_id = p_campaign_id AND replied = TRUE
    ),
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update campaign updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INBOX MANAGEMENT TABLES (EmailOrchestrator Pro)
-- ============================================================================

-- Email OAuth Tokens Table
CREATE TABLE IF NOT EXISTS email_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP,
  scope TEXT,
  email_address VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_email_oauth_tokens_user_id ON email_oauth_tokens(user_id);
CREATE INDEX idx_email_oauth_tokens_provider ON email_oauth_tokens(provider);

-- Email Cache Table
CREATE TABLE IF NOT EXISTS email_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  thread_id VARCHAR(255),
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[],
  cc_emails TEXT[],
  subject TEXT,
  snippet TEXT,
  body_plain TEXT,
  body_html TEXT,
  date TIMESTAMP,
  is_unread BOOLEAN DEFAULT TRUE,
  labels TEXT[],
  has_attachments BOOLEAN DEFAULT FALSE,
  provider VARCHAR(50) DEFAULT 'gmail',
  raw_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_cache_user_id ON email_cache(user_id);
CREATE INDEX idx_email_cache_message_id ON email_cache(message_id);
CREATE INDEX idx_email_cache_thread_id ON email_cache(thread_id);
CREATE INDEX idx_email_cache_user_date ON email_cache(user_id, date DESC);
CREATE INDEX idx_email_cache_unread ON email_cache(user_id, is_unread) WHERE is_unread = TRUE;
CREATE INDEX idx_email_cache_labels ON email_cache USING GIN(labels);

-- Schema created successfully
