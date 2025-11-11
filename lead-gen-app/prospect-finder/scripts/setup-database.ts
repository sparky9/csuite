/**
 * Database Setup Script
 *
 * Initializes Neon PostgreSQL database with schema, extensions, and views.
 * Run this once after getting Neon credentials: npm run db:setup
 */

import dotenv from 'dotenv';
import { db } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function setupDatabase() {
  console.log('='.repeat(80));
  console.log('ProspectFinder MCP - Database Setup');
  console.log('='.repeat(80));
  console.log();

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not found in environment variables');
    console.error();
    console.error('To fix this:');
    console.error('1. Sign up for Neon at https://neon.tech');
    console.error('2. Create a new project');
    console.error('3. Copy your connection string');
    console.error('4. Add it to .env file as DATABASE_URL=your-connection-string');
    console.error();
    process.exit(1);
  }

  console.log('Connecting to database...');
  console.log(`Host: ${new URL(databaseUrl).hostname}`);
  console.log();

  try {
    // Connect to database
    await db.connect(databaseUrl);
    console.log('✓ Database connection successful');
    console.log();

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
    console.log('Reading schema file...');
    console.log(`Path: ${schemaPath}`);
    console.log();

    let schemaSQL: string;
    try {
      schemaSQL = await fs.readFile(schemaPath, 'utf-8');
      console.log('✓ Schema file loaded');
      console.log(`Size: ${(schemaSQL.length / 1024).toFixed(2)} KB`);
      console.log();
    } catch (error) {
      console.error('ERROR: Failed to read schema file');
      console.error(error);
      process.exit(1);
    }

    // Execute schema
    console.log('Executing schema...');
    console.log('This will create:');
    console.log('  - Extensions (uuid-ossp, vector)');
    console.log('  - Tables (companies, decision_makers, scraping_jobs, duplicate_candidates)');
    console.log('  - Indexes (for performance)');
    console.log('  - Functions (data completeness calculation)');
    console.log('  - Views (callable_prospects, scraping_stats)');
    console.log('  - Triggers (auto-update timestamps)');
    console.log();

    try {
      await db.query(schemaSQL);
      console.log('✓ Schema executed successfully');
      console.log();
    } catch (error) {
      console.error('ERROR: Failed to execute schema');
      console.error(error);
      process.exit(1);
    }

    // Verify setup by checking tables
    console.log('Verifying database setup...');
    const tableCheck = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✓ Found ${tableCheck.rows.length} tables:`);
    tableCheck.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });
    console.log();

    // Check for pgvector extension
    const extensionCheck = await db.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname IN ('uuid-ossp', 'vector')
    `);

    console.log('✓ Extensions installed:');
    extensionCheck.rows.forEach((row) => {
      console.log(`  - ${row.extname} (version ${row.extversion})`);
    });
    console.log();

    // Success summary
    console.log('='.repeat(80));
    console.log('DATABASE SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Next steps:');
    console.log('1. Configure proxies (copy config/proxies.json.example to config/proxies.json)');
    console.log('2. Add proxy credentials to config/proxies.json');
    console.log('3. Configure Claude Desktop MCP (see README.md)');
    console.log('4. Test MCP server: npm run dev');
    console.log('5. In Claude Desktop, ask: "Find HVAC companies in Dallas"');
    console.log();
    console.log('Note: You will see mock data until scrapers are implemented (Day 4-6)');
    console.log();

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error();
    console.error('='.repeat(80));
    console.error('DATABASE SETUP FAILED');
    console.error('='.repeat(80));
    console.error();
    console.error('Error details:');
    console.error(error);
    console.error();
    console.error('Common issues:');
    console.error('1. Invalid DATABASE_URL - check your Neon connection string');
    console.error('2. Network connectivity - ensure you can reach Neon servers');
    console.error('3. Insufficient permissions - ensure your database user has CREATE privileges');
    console.error();
    console.error('For help, check:');
    console.error('- Neon documentation: https://neon.tech/docs');
    console.error('- README.md in this project');
    console.error();

    await db.disconnect();
    process.exit(1);
  }
}

// Run setup
setupDatabase();
