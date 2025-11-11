-- Social Media Manager schema
-- Adds scheduling and analytics tables that complement the ProspectFinder stack.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  platform TEXT NOT NULL,
  tone TEXT,
  hashtags TEXT[] DEFAULT '{}',
  emoji_count INT DEFAULT 0,
  character_count INT DEFAULT 0,
  confidence_score NUMERIC(4,3) DEFAULT 0.750,
  goal TEXT,
  audience TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  scheduled_for TIMESTAMP,
  status TEXT DEFAULT 'draft',
  thread_id UUID,
  thread_position INT
);

CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_schedule ON social_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_posts_thread ON social_posts(thread_id);

CREATE TABLE IF NOT EXISTS social_threads (
  id UUID PRIMARY KEY,
  user_id TEXT,
  platform TEXT NOT NULL,
  topic TEXT NOT NULL,
  hook TEXT,
  closing_remark TEXT,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_threads_user ON social_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_social_threads_platform ON social_threads(platform);

CREATE TABLE IF NOT EXISTS social_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platforms TEXT[] NOT NULL,
  schedule_time TIMESTAMP NOT NULL,
  schedule_window TEXT,
  strategy TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_schedules_user ON social_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_social_schedules_time ON social_schedules(schedule_time);

CREATE TABLE IF NOT EXISTS social_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platform TEXT NOT NULL,
  date_range TEXT NOT NULL,
  impressions INT,
  engagement INT,
  followers INT,
  follower_growth INT,
  engagement_rate NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  metrics JSONB,
  insights JSONB
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_user ON social_analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_social_analytics_platform ON social_analytics_snapshots(platform);

CREATE TABLE IF NOT EXISTS social_hashtag_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platform TEXT NOT NULL,
  tag TEXT NOT NULL,
  usage_count INT DEFAULT 0,
  volume TEXT,
  competition TEXT,
  relevance_score NUMERIC(4,3) DEFAULT 0.600,
  strategy TEXT,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, platform, tag)
);

CREATE INDEX IF NOT EXISTS idx_social_hashtag_platform ON social_hashtag_library(platform);
CREATE INDEX IF NOT EXISTS idx_social_hashtag_user ON social_hashtag_library(user_id);

CREATE TABLE IF NOT EXISTS social_competitor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platform TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  followers INT,
  engagement_rate NUMERIC(5,2),
  post_frequency TEXT,
  content_themes TEXT[] DEFAULT '{}',
  top_hashtags TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, platform, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_social_competitor_user ON social_competitor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_social_competitor_platform ON social_competitor_profiles(platform);

CREATE TABLE IF NOT EXISTS social_competitor_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platform TEXT NOT NULL,
  depth TEXT NOT NULL,
  your_position TEXT,
  opportunities TEXT[] DEFAULT '{}',
  threats TEXT[] DEFAULT '{}',
  focus_areas TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_competitor_summary_user ON social_competitor_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_social_competitor_summary_platform ON social_competitor_summaries(platform);

CREATE TABLE IF NOT EXISTS social_content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  week_number INT NOT NULL,
  day_name TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT,
  theme TEXT,
  topic TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_calendar_user ON social_content_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_social_calendar_platform ON social_content_calendar(platform);
CREATE INDEX IF NOT EXISTS idx_social_calendar_week ON social_content_calendar(week_number);

CREATE TABLE IF NOT EXISTS social_content_calendar_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  duration_weeks INT,
  posts_per_week INT,
  platforms TEXT[] DEFAULT '{}',
  content_mix JSONB,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_calendar_summary_user ON social_content_calendar_summaries(user_id);

CREATE TABLE IF NOT EXISTS social_trend_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  industry TEXT NOT NULL,
  platform TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  include_competitors BOOLEAN DEFAULT false,
  opportunities TEXT[] DEFAULT '{}',
  alerts TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_trend_user ON social_trend_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_social_trend_platform ON social_trend_snapshots(platform);

CREATE TABLE IF NOT EXISTS social_trend_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID REFERENCES social_trend_snapshots(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  volume TEXT,
  relevance_score NUMERIC(4,2),
  growth_rate TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS social_trend_hashtags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID REFERENCES social_trend_snapshots(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL,
  volume INT,
  trending BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS social_timing_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  platform TEXT NOT NULL,
  audience_timezone TEXT,
  content_type TEXT,
  optimal_times JSONB,
  engagement_windows JSONB,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_timing_user ON social_timing_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_social_timing_platform ON social_timing_recommendations(platform);

CREATE TABLE IF NOT EXISTS social_competitor_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  competitor_website TEXT,
  service_name TEXT NOT NULL,
  price_low NUMERIC(10,2),
  price_high NUMERIC(10,2),
  pricing_model TEXT,
  currency TEXT DEFAULT 'USD',
  last_checked TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, competitor_name, service_name)
);

CREATE INDEX IF NOT EXISTS idx_social_competitor_pricing_user ON social_competitor_pricing(user_id);
CREATE INDEX IF NOT EXISTS idx_social_competitor_pricing_service ON social_competitor_pricing(service_name);

CREATE TABLE IF NOT EXISTS social_competitor_price_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pricing_id UUID REFERENCES social_competitor_pricing(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  old_price_low NUMERIC(10,2),
  old_price_high NUMERIC(10,2),
  new_price_low NUMERIC(10,2),
  new_price_high NUMERIC(10,2),
  change_percent NUMERIC(5,2),
  change_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_price_changes_pricing ON social_competitor_price_changes(pricing_id);
