#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  console.log('Research Insights Database Setup');
  console.log('==================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to your .env file and retry.');
    process.exit(1);
  }

  console.log(`Connecting to ${databaseUrl}\n`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('amazonaws.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    console.log('Testing database connectivity...');
    const test = await pool.query('SELECT NOW() as now');
    console.log(`✓ Connected at ${test.rows[0].now}`);

    console.log('\nEnsuring pgcrypto extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    console.log('✓ pgcrypto ready');

    console.log('\nApplying schema...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);
    console.log('✓ Schema applied');

    console.log('\nVerifying tables...');
    const tables = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('research_sources', 'research_snapshots')
      ORDER BY tablename
    `);

    for (const row of tables.rows) {
      console.log(`  • ${row.tablename}`);
    }

    console.log('\nDatabase setup complete.');
  } catch (error) {
    console.error('Database setup failed.');
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Fatal error during setup.');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
