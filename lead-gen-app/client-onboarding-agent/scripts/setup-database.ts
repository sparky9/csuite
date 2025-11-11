import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeOnboardingDb, getPool, shutdownOnboardingDb } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    await initializeOnboardingDb();
    const pool = getPool();
    const schemaPath = resolve(__dirname, '../src/db/schema.sql');
    const sql = await readFile(schemaPath, 'utf8');

    logger.info('Applying onboarding schema', { schemaPath });
    await pool.query(sql);
    logger.info('Onboarding schema applied successfully');
  } catch (error: any) {
    logger.error('Failed to apply onboarding schema', { error: error.message });
    process.exitCode = 1;
  } finally {
    await shutdownOnboardingDb();
  }
}

run();
