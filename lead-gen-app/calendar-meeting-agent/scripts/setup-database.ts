import fs from 'node:fs/promises';
import path from 'node:path';

import 'dotenv/config';
import { calendarDb, initializeCalendarDb, shutdownCalendarDb } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required to run the database setup script.');
  }

  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');

  await initializeCalendarDb();

  logger.info('Applying calendar meeting agent schema');
  await calendarDb.query(schema);
  logger.info('Schema applied successfully');

  await shutdownCalendarDb();
}

main().catch(async (error) => {
  logger.error('Failed to apply schema', { error: error.message });
  await shutdownCalendarDb();
  process.exitCode = 1;
});
