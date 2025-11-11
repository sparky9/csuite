CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Testimonial requests
CREATE TABLE IF NOT EXISTS reputation_testimonial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  completion_date DATE,
  request_template TEXT,
  delivery_method TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending',
  follow_up_days INTEGER DEFAULT 7,
  follow_up_sent_at TIMESTAMPTZ,
  follow_up_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonial_requests_user ON reputation_testimonial_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_status ON reputation_testimonial_requests(status);

-- Received testimonials
CREATE TABLE IF NOT EXISTS reputation_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES reputation_testimonial_requests(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_title TEXT,
  client_company TEXT,
  testimonial_text TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  permission_granted BOOLEAN NOT NULL DEFAULT false,
  received_date DATE NOT NULL,
  public_use_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_user ON reputation_testimonials(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON reputation_testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_public_use ON reputation_testimonials(public_use_approved);

-- Review site funneling
CREATE TABLE IF NOT EXISTS reputation_review_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id UUID REFERENCES reputation_testimonials(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  business_profile_url TEXT NOT NULL,
  message_template TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  review_url TEXT,
  public_rating INTEGER CHECK (public_rating BETWEEN 1 AND 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_funnels_user ON reputation_review_funnels(user_id);
CREATE INDEX IF NOT EXISTS idx_review_funnels_platform ON reputation_review_funnels(platform);
CREATE INDEX IF NOT EXISTS idx_review_funnels_status ON reputation_review_funnels(status);

-- Negative feedback triage
CREATE TABLE IF NOT EXISTS reputation_negative_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  issue_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  task_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negative_feedback_user ON reputation_negative_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_negative_feedback_status ON reputation_negative_feedback(status);
CREATE INDEX IF NOT EXISTS idx_negative_feedback_severity ON reputation_negative_feedback(severity);

-- Case studies
CREATE TABLE IF NOT EXISTS reputation_case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id UUID REFERENCES reputation_testimonials(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,
  metrics_included BOOLEAN DEFAULT false,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_user ON reputation_case_studies(user_id);

-- Audit log
CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user ON reputation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_type ON reputation_events(event_type);

-- Trigger to update updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'reputation_testimonial_requests',
    'reputation_testimonials',
    'reputation_review_funnels',
    'reputation_negative_feedback',
    'reputation_case_studies'
  ) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I',
      rec.tablename,
      rec.tablename
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      rec.tablename,
      rec.tablename
    );
  END LOOP;
END;
$$;
