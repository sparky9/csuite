import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { applyDatabaseSchema, initializeDatabase, shutdownDatabase } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  try {
    await initializeDatabase();
    await applyDatabaseSchema();
    logger.info('Database schema applied successfully.');
    console.log('Time & Billing schema applied successfully.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to set up database schema', { error: message });
    console.error('Failed to set up database schema:', message);
    process.exitCode = 1;
  } finally {
    await shutdownDatabase();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Unhandled error during database setup', { error: message });
  console.error('Unhandled error during database setup:', message);
  await shutdownDatabase();
  process.exit(1);
});
