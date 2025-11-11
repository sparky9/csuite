import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { db, query } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

async function main(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');
  logger.info('Applying reputation schema', { schemaPath });

  await db.connect();

  try {
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');
    await query(schemaSql);
    logger.info('Database schema applied successfully');
  } catch (error) {
    logger.error('Failed to apply database schema', {
      error: error instanceof Error ? error.message : error
    });
    throw error;
  } finally {
    await db.disconnect();
  }
}

main().catch((error) => {
  logger.error('setup-database script failed', {
    error: error instanceof Error ? error.message : error
  });
  process.exit(1);
});
