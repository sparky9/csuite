-- Calendar Meeting Agent schema
-- Provides persistence for deterministic scheduling and analytics.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cm_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cm_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT,
  display_name TEXT,
  timezone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sync_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS cm_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id UUID REFERENCES cm_calendars(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT,
  status TEXT DEFAULT 'scheduled',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  timezone TEXT NOT NULL,
  location TEXT,
  is_all_day BOOLEAN DEFAULT false,
  conferencing_link TEXT,
  agenda JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(calendar_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_events_calendar_time ON cm_events(calendar_id, start_time, end_time);

CREATE TABLE IF NOT EXISTS cm_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES cm_events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  response_status TEXT DEFAULT 'needs_action',
  importance TEXT DEFAULT 'normal',
  is_required BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_attendees_event ON cm_attendees(event_id);

CREATE TABLE IF NOT EXISTS cm_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, preference_type)
);

CREATE TABLE IF NOT EXISTS cm_availability_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  timezone TEXT NOT NULL,
  busy_blocks JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_availability_user ON cm_availability_snapshots(user_id, window_start);

CREATE TABLE IF NOT EXISTS cm_scheduling_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  meeting_type TEXT,
  duration_minutes INT NOT NULL,
  requested_start TIMESTAMP,
  requested_end TIMESTAMP,
  participants JSONB NOT NULL,
  constraints JSONB DEFAULT '{}'::jsonb,
  proposed_slots JSONB,
  selected_slot JSONB,
  status TEXT DEFAULT 'proposed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_sched_req_user ON cm_scheduling_requests(user_id, status);

CREATE TABLE IF NOT EXISTS cm_meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES cm_events(id) ON DELETE CASCADE,
  notes JSONB NOT NULL,
  action_items JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cm_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES cm_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cm_sync_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES cm_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_sync_audit_user ON cm_sync_audit(user_id, occurred_at);
