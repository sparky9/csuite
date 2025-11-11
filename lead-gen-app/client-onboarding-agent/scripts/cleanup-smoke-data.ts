import { initializeOnboardingDb, getPool, shutdownOnboardingDb } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

async function run() {
  try {
    await initializeOnboardingDb();
    const pool = getPool();

    const result = await pool.query(
      `WITH removed_plans AS (
         DELETE FROM onboarding_plans
         WHERE summary = 'Smoke Test plan'
            OR client_name = 'Smoke Test Client'
         RETURNING id
       ),
       removed_templates AS (
         DELETE FROM onboarding_templates
         WHERE metadata ->> 'smokeTest' = 'true'
           OR name LIKE 'Smoke Test%'
         RETURNING id
       )
       SELECT (
         SELECT COUNT(*) FROM removed_plans
       ) AS plans, (
         SELECT COUNT(*) FROM removed_templates
       ) AS templates`);

    logger.info('Smoke data cleanup complete', {
      removedPlans: Number(result.rows[0]?.plans ?? 0),
      removedTemplates: Number(result.rows[0]?.templates ?? 0),
    });
  } catch (error: any) {
    logger.error('Failed to cleanup smoke data', { error: error.message });
    process.exitCode = 1;
  } finally {
    await shutdownOnboardingDb();
  }
}

run();
