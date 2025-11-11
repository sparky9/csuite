-- Research Insights standalone schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS research_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

CREATE OR REPLACE FUNCTION update_research_source_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_research_sources_updated_at'
  ) THEN
    CREATE TRIGGER trg_research_sources_updated_at
    BEFORE UPDATE ON research_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_research_source_timestamp();
  END IF;
END;
$$;
