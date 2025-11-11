-- LeadTracker Pro - Initial Migration
-- This migration sets up the complete LeadTracker Pro schema
-- Run this AFTER ProspectFinder database is set up (uses same Neon DB)

-- Execute the full schema
\i src/db/schema.sql

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('prospects', 'contacts', 'activities', 'follow_ups', 'leadtracker_config')
ORDER BY table_name;

-- Verify indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('prospects', 'contacts', 'activities', 'follow_ups')
ORDER BY tablename, indexname;

-- Migration complete
