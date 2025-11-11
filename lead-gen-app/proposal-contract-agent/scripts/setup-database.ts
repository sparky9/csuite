/// <reference types="node" />
import { readFileSync } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it to your .env file.');
  process.exit(1);
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // Apply main schema
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Main database schema applied successfully.');

    // Apply e-signature schema extension
    const esignSchemaPath = path.resolve(__dirname, '../src/db/schema-esignature.sql');
    const esignSchema = readFileSync(esignSchemaPath, 'utf8');
    await client.query(esignSchema);
    console.log('E-signature schema extension applied successfully.');

    console.log('All database schemas applied successfully.');
  } catch (error) {
    console.error('Failed to apply schema:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
