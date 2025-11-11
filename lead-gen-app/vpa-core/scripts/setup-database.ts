#!/usr/bin/env node

/**
 * Database Setup Script
 *
 * Initializes VPA Core database schema:
 * - Creates multi-tenant tables (users, subscriptions, usage, config)
 * - Adds user_id columns to existing module tables
 * - Creates indexes and views
 * - Seeds test data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main setup function
 */
async function setupDatabase() {
  console.log('VPA Core Database Setup');
  console.log('======================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    console.error('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  console.log('Database URL:', databaseUrl.substring(0, 30) + '...\n');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('amazonaws.com')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    // Test connection
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connected at:', testResult.rows[0].now);
    console.log('');

    // Read schema file
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    console.log('Reading schema file:', schemaPath);

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✓ Schema file loaded');
    console.log('');

    // Execute schema
    console.log('Executing database schema...');
    await pool.query(schema);
    console.log('✓ Schema executed successfully');
    console.log('');

    // Verify tables were created
    console.log('Verifying tables...');
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'user_subscriptions', 'user_usage', 'user_module_config', 'research_sources', 'research_snapshots')
      ORDER BY tablename
    `);

    console.log('Created tables:');
    for (const row of tablesResult.rows) {
      console.log(`  ✓ ${row.tablename}`);
    }
    console.log('');

    // Check for test user
    const userResult = await pool.query('SELECT email, license_key FROM users LIMIT 1');
    if (userResult.rows.length > 0) {
      console.log('Test user created:');
      console.log(`  Email: ${userResult.rows[0].email}`);
      console.log(`  License Key: ${userResult.rows[0].license_key}`);
      console.log('');
    }

    console.log('✓ Database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your .env file with LICENSE_KEY (use the test license key above for testing)');
    console.log('2. Run: npm run build');
    console.log('3. Run: npm run dev');
    console.log('');

  } catch (error) {
    console.error('ERROR: Database setup failed');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run setup
setupDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
