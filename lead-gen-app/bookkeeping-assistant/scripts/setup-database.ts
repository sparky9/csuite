/**
 * Bookkeeping Assistant database setup
 * Applies the bookkeeping schema to the configured database.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeBookkeepingDb, bookkeepingDb, shutdownBookkeepingDb } from '../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function run() {
  console.log('='.repeat(80));
  console.log('Bookkeeping Assistant - Database Setup');
  console.log('='.repeat(80));
  console.log();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Add it to your .env file before running this script.');
    process.exit(1);
  }

  try {
    const connected = await initializeBookkeepingDb(databaseUrl);
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');

    console.log('Applying bookkeeping schema...');
    await bookkeepingDb.query(schema);

    console.log('Schema applied successfully.');
  } catch (error) {
    console.error('Database setup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await shutdownBookkeepingDb();
  }
}

run();
