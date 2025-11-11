-- ProspectFinder MCP Database Schema
-- PostgreSQL with pgvector extension

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Companies table: Core prospect data
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Information
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Location
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',

  -- Business Details
  industry TEXT,
  business_category TEXT, -- e.g., "HVAC", "Plumbing", "Electrical"
  employee_count_estimate INTEGER,
  revenue_estimate TEXT,

  -- Source URLs
  google_maps_url TEXT,
  linkedin_url TEXT,

  -- Ratings & Reviews
  rating DECIMAL(2,1),
  review_count INTEGER,

  -- Data Quality
  data_quality_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
  data_completeness_pct INTEGER DEFAULT 0, -- 0 to 100

  -- RAG: Vector embedding for deduplication
  embedding vector(1536),

  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  last_enriched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate entries from same source
  UNIQUE(google_maps_url),
  UNIQUE(linkedin_url)
);

-- Decision makers table: People at companies
CREATE TABLE IF NOT EXISTS decision_makers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Personal Information
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,

  -- Contact Information
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Metadata
  found_via TEXT, -- 'linkedin', 'website', 'email_pattern'
  confidence_score DECIMAL(3,2) DEFAULT 0.50, -- How confident we are in this data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate people
  UNIQUE(company_id, linkedin_url)
);

-- Scraping jobs table: Track scraping operations and rate limiting
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Job Configuration
  job_type TEXT NOT NULL, -- 'google_maps', 'linkedin_company', 'linkedin_people', 'email_finder'
  parameters JSONB NOT NULL, -- Store search criteria

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'rate_limited'
  progress_pct INTEGER DEFAULT 0,

  -- Results
  results_count INTEGER DEFAULT 0,
  companies_found INTEGER DEFAULT 0,
  people_found INTEGER DEFAULT 0,

  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Performance Metrics
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Rate Limiting Info
  proxy_used TEXT,
  rate_limit_hit BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Duplicate candidates table: Track potential duplicates found by RAG
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id_1 UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_id_2 UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Similarity Metrics
  similarity_score DECIMAL(4,3), -- 0.000 to 1.000 (cosine similarity)
  name_similarity DECIMAL(3,2),
  location_match BOOLEAN,

  -- Resolution
  is_duplicate BOOLEAN, -- NULL = unreviewed, TRUE = confirmed duplicate, FALSE = not duplicate
  merged_into_id UUID REFERENCES companies(id),
  reviewed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Prevent reverse duplicates (A->B and B->A)
  UNIQUE(company_id_1, company_id_2),
  CHECK (company_id_1 < company_id_2)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(business_category);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(city, state);
CREATE INDEX IF NOT EXISTS idx_companies_quality ON companies(data_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_created ON companies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_makers_company ON decision_makers(company_id);
CREATE INDEX IF NOT EXISTS idx_decision_makers_name ON decision_makers(full_name);

CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON scraping_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created ON scraping_jobs(created_at DESC);

-- pgvector index for similarity search (RAG deduplication)
-- Using ivfflat (Inverted File Flat) for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_companies_embedding ON companies
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers: Auto-update updated_at on row modification
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decision_makers_updated_at BEFORE UPDATE ON decision_makers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate data completeness percentage
CREATE OR REPLACE FUNCTION calculate_data_completeness(company_row companies)
RETURNS INTEGER AS $$
DECLARE
  field_count INTEGER := 0;
  filled_count INTEGER := 0;
BEGIN
  -- Count total fields
  field_count := 10;

  -- Count filled fields
  IF company_row.phone IS NOT NULL AND company_row.phone != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.email IS NOT NULL AND company_row.email != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.website IS NOT NULL AND company_row.website != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.address IS NOT NULL AND company_row.address != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.industry IS NOT NULL AND company_row.industry != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.business_category IS NOT NULL AND company_row.business_category != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.employee_count_estimate IS NOT NULL THEN filled_count := filled_count + 1; END IF;
  IF company_row.rating IS NOT NULL THEN filled_count := filled_count + 1; END IF;
  IF company_row.linkedin_url IS NOT NULL AND company_row.linkedin_url != '' THEN filled_count := filled_count + 1; END IF;
  IF company_row.google_maps_url IS NOT NULL AND company_row.google_maps_url != '' THEN filled_count := filled_count + 1; END IF;

  RETURN (filled_count * 100 / field_count);
END;
$$ LANGUAGE plpgsql;

-- View: High-quality prospects ready for calling
CREATE OR REPLACE VIEW callable_prospects AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.email,
  c.website,
  c.address,
  c.city,
  c.state,
  c.industry,
  c.business_category,
  c.employee_count_estimate,
  c.rating,
  c.data_quality_score,
  c.data_completeness_pct,
  COUNT(dm.id) as decision_maker_count,
  STRING_AGG(dm.full_name || ' (' || COALESCE(dm.title, 'Unknown') || ')', ', ') as decision_makers
FROM companies c
LEFT JOIN decision_makers dm ON c.id = dm.company_id
WHERE c.phone IS NOT NULL
  AND c.data_quality_score >= 0.60
GROUP BY c.id
ORDER BY c.data_quality_score DESC, decision_maker_count DESC;

-- View: Scraping statistics
CREATE OR REPLACE VIEW scraping_stats AS
SELECT
  job_type,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
  COUNT(*) FILTER (WHERE status = 'running') as running_jobs,
  COUNT(*) FILTER (WHERE rate_limit_hit = TRUE) as rate_limited_jobs,
  SUM(results_count) as total_results,
  AVG(duration_seconds) as avg_duration_seconds,
  MAX(created_at) as last_run_at
FROM scraping_jobs
GROUP BY job_type;
