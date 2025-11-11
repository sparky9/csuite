/**
 * Migration Script: Add Multi-User Support
 * Adds user_id columns and new indexes to existing LeadTracker Pro databases
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('\n========================================', colors.cyan);
  log('LeadTracker Pro Multi-User Migration', colors.bright + colors.cyan);
  log('========================================\n', colors.cyan);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('❌ ERROR: DATABASE_URL not found in environment variables', colors.red);
    process.exit(1);
  }

  log('📊 Connecting to database...', colors.blue);

  let pool: pg.Pool | null = null;

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await pool.query('SELECT NOW()');
    log('✅ Connected successfully!\n', colors.green);

    // Check if migration is needed
    log('🔍 Checking current schema...', colors.blue);
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prospects'
        AND column_name = 'user_id'
    `);

    if (columnsResult.rows.length > 0) {
      log('✅ Database already has user_id columns - no migration needed!', colors.green);
      log('   Your database is up to date.\n', colors.reset);
      return;
    }

    log('📝 Migration needed - adding multi-user support...\n', colors.yellow);

    // Add user_id columns
    log('1. Adding user_id column to prospects table...', colors.blue);
    await pool.query('ALTER TABLE prospects ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
    log('   ✅ Done', colors.green);

    log('2. Adding user_id column to contacts table...', colors.blue);
    await pool.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
    log('   ✅ Done', colors.green);

    log('3. Adding user_id column to activities table...', colors.blue);
    await pool.query('ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
    log('   ✅ Done', colors.green);

    log('4. Adding user_id column to follow_ups table...', colors.blue);
    await pool.query('ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
    log('   ✅ Done', colors.green);

    // Add indexes
    log('\n5. Creating performance indexes...', colors.blue);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_prospects_user_status ON prospects(user_id, status)');
    log('   ✅ Prospects indexes created', colors.green);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)');
    log('   ✅ Contacts indexes created', colors.green);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_activities_user_prospect ON activities(user_id, prospect_id, activity_date DESC)');
    log('   ✅ Activities indexes created', colors.green);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id)');
    log('   ✅ Follow-ups indexes created', colors.green);

    // Add configuration values
    log('\n6. Adding configuration settings...', colors.blue);
    await pool.query(`
      INSERT INTO leadtracker_config (key, value, description) VALUES
        ('scoring_stage_weights', '{"new":6,"contacted":12,"qualified":18,"meeting_scheduled":26,"proposal_sent":32,"negotiating":38,"closed_won":0,"closed_lost":0,"on_hold":0}', 'Stage weights for next-action scoring'),
        ('scoring_deal_thresholds', '[{"threshold":25000,"weight":24},{"threshold":15000,"weight":20},{"threshold":10000,"weight":16},{"threshold":5000,"weight":12},{"threshold":2000,"weight":8},{"threshold":0,"weight":4}]', 'Deal value thresholds and weights for scoring'),
        ('scoring_priority_thresholds', '{"urgent":160,"high":120}', 'Score thresholds for priority classification (urgent, high, normal)')
      ON CONFLICT (key) DO NOTHING
    `);
    log('   ✅ Configuration added', colors.green);

    log('\n========================================', colors.green);
    log('✅ MIGRATION COMPLETE!', colors.bright + colors.green);
    log('========================================\n', colors.green);

    log('📋 Changes made:', colors.cyan);
    log('- Added user_id columns to all tables', colors.reset);
    log('- Created composite indexes for performance', colors.reset);
    log('- Added tunable scoring configurations\n', colors.reset);

    log('📚 Next steps:', colors.cyan);
    log('1. Rebuild the project: npm run build', colors.reset);
    log('2. Restart Claude Desktop to load updated server\n', colors.reset);

  } catch (error) {
    log('\n❌ ERROR during migration:', colors.red);
    log((error as Error).message, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      log('🔌 Database connection closed\n', colors.blue);
    }
  }
}

main().catch((error) => {
  log('\n❌ FATAL ERROR:', colors.red);
  console.error(error);
  process.exit(1);
});
