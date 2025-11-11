import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the retention schema migration');
  }

  const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf-8');

  const { Client } = pg;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('Retention & Renewal schema applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to apply schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Database setup failed:', error);
  process.exitCode = 1;
});
