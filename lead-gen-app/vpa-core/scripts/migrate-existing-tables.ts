/**
 * Database Migration Script
 * Add user_id columns to existing tables for multi-tenancy
 *
 * Run this script ONCE during VPA deployment to add user_id support
 * to ProspectFinder, LeadTracker, and EmailOrchestrator tables.
 *
 * Usage:
 *   npm run db:migrate
 *
 * IMPORTANT: This is a ONE-TIME migration. Only run when deploying VPA Core.
 */

import { db } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateExistingTables() {
  logger.info('========================================');
  logger.info('VPA Core - Database Migration');
  logger.info('Adding user_id columns for multi-tenancy');
  logger.info('========================================');

  try {
    // Connect to database
    await db.connect();
    logger.info('✓ Connected to database');

    // ========================================================================
    // PROSPECT FINDER TABLES
    // ========================================================================

    logger.info('\n[ProspectFinder] Migrating tables...');

    // Companies table
    await db.query(`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ companies: user_id column added');

    // Decision makers table
    await db.query(`
      ALTER TABLE decision_makers
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ decision_makers: user_id column added');

    // Scraping jobs table
    await db.query(`
      ALTER TABLE scraping_jobs
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ scraping_jobs: user_id column added');

    // ========================================================================
    // LEAD TRACKER TABLES
    // ========================================================================

    logger.info('\n[LeadTracker] Migrating tables...');

    // Prospects table
    await db.query(`
      ALTER TABLE prospects
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ prospects: user_id column added');

    // Contacts table
    await db.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ contacts: user_id column added');

    // Activities table
    await db.query(`
      ALTER TABLE activities
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ activities: user_id column added');

    // Follow-ups table
    await db.query(`
      ALTER TABLE follow_ups
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ follow_ups: user_id column added');

    // ========================================================================
    // EMAIL ORCHESTRATOR TABLES
    // ========================================================================

    logger.info('\n[EmailOrchestrator] Migrating tables...');

    // Campaigns table
    await db.query(`
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ campaigns: user_id column added');

    // Email sequences table
    await db.query(`
      ALTER TABLE email_sequences
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ email_sequences: user_id column added');

    // Sent emails table
    await db.query(`
      ALTER TABLE sent_emails
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ sent_emails: user_id column added');

    // Email templates table
    await db.query(`
      ALTER TABLE email_templates
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ email_templates: user_id column added');

    // Email tracking table
    await db.query(`
      ALTER TABLE email_tracking
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id)
    `);
    logger.info('  ✓ email_tracking: user_id column added');

    // ========================================================================
    // CREATE INDEXES FOR PERFORMANCE
    // ========================================================================

    logger.info('\n[Indexes] Creating performance indexes...');

    await db.query('CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_decision_makers_user_id ON decision_makers(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON scraping_jobs(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_email_sequences_user_id ON email_sequences(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id ON sent_emails(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_email_tracking_user_id ON email_tracking(user_id)');

    logger.info('  ✓ All indexes created successfully');

    // ========================================================================
    // SUMMARY
    // ========================================================================

    logger.info('\n========================================');
    logger.info('✅ Migration Complete!');
    logger.info('========================================');
    logger.info('\nTables updated:');
    logger.info('  • ProspectFinder: 3 tables (companies, decision_makers, scraping_jobs)');
    logger.info('  • LeadTracker: 4 tables (prospects, contacts, activities, follow_ups)');
    logger.info('  • EmailOrchestrator: 5 tables (campaigns, email_sequences, sent_emails, email_templates, email_tracking)');
    logger.info('\nIndexes created: 12');
    logger.info('\nNext steps:');
    logger.info('  1. Existing data will have NULL user_id (acceptable for initial users)');
    logger.info('  2. New data will automatically include user_id');
    logger.info('  3. Run VPA Core and test multi-tenant functionality');
    logger.info('\n========================================\n');

  } catch (error) {
    logger.error('❌ Migration failed!', { error });
    logger.error('Error details:', error);
    throw error;
  } finally {
    await db.disconnect();
    logger.info('Database connection closed');
  }
}

// Run migration
migrateExistingTables()
  .then(() => {
    logger.info('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration script failed', { error });
    process.exit(1);
  });
