/**
 * Database setup script for LeadTracker Pro
 * Creates tables, indexes, views, and triggers
 */

import dotenv from 'dotenv';
import { promises as fs } from 'fs';
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
  log('LeadTracker Pro Database Setup', colors.bright + colors.cyan);
  log('========================================\n', colors.cyan);

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('❌ ERROR: DATABASE_URL not found in environment variables', colors.red);
    log('Please create a .env file with DATABASE_URL set to your Neon PostgreSQL connection string.\n', colors.yellow);
    process.exit(1);
  }

  log('📊 Connecting to database...', colors.blue);

  let pool: pg.Pool | null = null;

  try {
    // Create connection pool
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    // Test connection
    const testResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    log('✅ Connected successfully!', colors.green);
    log(`   Time: ${testResult.rows[0].current_time}`, colors.reset);
    log(`   PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[1]}\n`, colors.reset);

    // Read schema file
    log('📄 Reading schema.sql...', colors.blue);
    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    log('✅ Schema file loaded\n', colors.green);

    // Execute schema
    log('🔨 Creating database objects...', colors.blue);
    log('   - Extensions (uuid-ossp)', colors.reset);
    log('   - Tables (prospects, contacts, activities, follow_ups, leadtracker_config)', colors.reset);
    log('   - Indexes', colors.reset);
    log('   - Views (pipeline_summary, overdue_follow_ups, activity_summary, top_prospects)', colors.reset);
    log('   - Triggers\n', colors.reset);

    await pool.query(schema);

    log('✅ Database objects created successfully!\n', colors.green);

    // Verify tables
    log('🔍 Verifying tables...', colors.blue);
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('prospects', 'contacts', 'activities', 'follow_ups', 'leadtracker_config')
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map((r) => r.table_name);
    const expectedTables = ['activities', 'contacts', 'follow_ups', 'leadtracker_config', 'prospects'];
    const allTablesPresent = expectedTables.every((t) => tables.includes(t));

    if (allTablesPresent) {
      log('✅ All tables created:', colors.green);
      tables.forEach((table) => log(`   • ${table}`, colors.reset));
      log('', colors.reset);
    } else {
      log('⚠️  Warning: Some tables may be missing', colors.yellow);
      log(`   Expected: ${expectedTables.join(', ')}`, colors.reset);
      log(`   Found: ${tables.join(', ')}\n`, colors.reset);
    }

    // Verify views
    log('🔍 Verifying views...', colors.blue);
    const viewsResult = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN ('pipeline_summary', 'overdue_follow_ups', 'activity_summary', 'top_prospects')
      ORDER BY table_name
    `);

    const views = viewsResult.rows.map((r) => r.table_name);
    if (views.length > 0) {
      log('✅ Views created:', colors.green);
      views.forEach((view) => log(`   • ${view}`, colors.reset));
      log('', colors.reset);
    }

    // Check configuration
    log('🔍 Checking configuration...', colors.blue);
    const configResult = await pool.query('SELECT * FROM leadtracker_config');
    log('✅ Configuration:', colors.green);
    configResult.rows.forEach((config) => {
      log(`   • ${config.key} = ${config.value}`, colors.reset);
      if (config.description) {
        log(`     ${config.description}`, colors.reset);
      }
    });
    log('', colors.reset);

    // Success summary
    log('========================================', colors.green);
    log('✅ SETUP COMPLETE!', colors.bright + colors.green);
    log('========================================\n', colors.green);

    log('📋 Next steps:', colors.cyan);
    log('1. Update your Claude Desktop MCP configuration:', colors.reset);
    log('   Add LeadTracker Pro server to claude_desktop_config.json\n', colors.reset);
    log('2. Start using LeadTracker Pro:', colors.reset);
    log('   - add_prospect: Create new prospects', colors.reset);
    log('   - add_contact: Add decision makers', colors.reset);
    log('   - log_activity: Track calls, emails, meetings', colors.reset);
    log('   - search_prospects: Find and filter prospects', colors.reset);
    log('   - get_follow_ups: View reminders', colors.reset);
    log('   - get_pipeline_stats: Pipeline metrics', colors.reset);
    log('   - import_prospects: Import from ProspectFinder\n', colors.reset);

    log('📚 See README.md for detailed instructions\n', colors.cyan);
  } catch (error) {
    log('\n❌ ERROR during setup:', colors.red);
    log((error as Error).message, colors.red);
    log((error as Error).stack || '', colors.reset);
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
