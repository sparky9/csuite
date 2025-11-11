/**
 * Database setup script for EmailOrchestrator
 * Creates all tables, views, and functions
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setup() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    console.log('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  console.log('EmailOrchestrator Database Setup');
  console.log('================================\n');

  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected\n');

    // Read schema file
    const schemaPath = join(__dirname, '..', 'src', 'db', 'schema.sql');
    console.log('Reading schema from:', schemaPath);
    const schema = readFileSync(schemaPath, 'utf-8');
    console.log('✓ Schema file loaded\n');

    // Execute schema
    console.log('Creating database objects...');
    await client.query(schema);
    console.log('✓ Schema executed successfully\n');

    // Verify tables created
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'campaigns',
          'email_templates',
          'email_sequences',
          'sent_emails',
          'email_tracking',
          'campaign_prospects',
          'unsubscribes',
          'email_config'
        )
      ORDER BY table_name
    `);

    console.log('Tables created:');
    tableCheck.rows.forEach((row) => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log();

    // Verify views created
    const viewCheck = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN (
          'campaign_performance',
          'pending_sends',
          'email_activity_timeline',
          'template_performance'
        )
      ORDER BY table_name
    `);

    console.log('Views created:');
    viewCheck.rows.forEach((row) => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log();

    // Check default config
    const configCheck = await client.query('SELECT key, value FROM email_config ORDER BY key');

    console.log('Email configuration:');
    configCheck.rows.forEach((row) => {
      console.log(`  ${row.key}: ${row.value}`);
    });
    console.log();

    console.log('========================================');
    console.log('Database setup completed successfully!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Set up Gmail OAuth: npm run gmail:auth');
    console.log('2. Update company info in email_config table');
    console.log('3. Start the MCP server: npm run dev');
    console.log('4. Configure Claude Desktop to use this server\n');
  } catch (error: any) {
    console.error('ERROR during setup:', error.message);
    if (error.position) {
      console.error('Error at position:', error.position);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
