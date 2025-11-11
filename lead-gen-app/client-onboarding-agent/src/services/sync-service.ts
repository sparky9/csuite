import { syncUpdateInputSchema } from '../types/onboarding.js';
import { getPool } from '../db/client.js';
import { logger } from '../utils/logger.js';

export const buildSyncUpdate = async (input: unknown) => {
  const parsed = syncUpdateInputSchema.parse(input);
  const { planId, system } = parsed;
  const pool = getPool();

  const planResult = await pool.query('SELECT * FROM onboarding_plans WHERE id = $1', [planId]);

  if (planResult.rowCount === 0) {
    logger.warn('Sync payload requested for missing plan', { planId, system });
    throw new Error('Plan not found for sync export.');
  }

  const plan = planResult.rows[0];

  const stepsResult = await pool.query(
    `SELECT stage_name, title, status, due_date FROM onboarding_plan_steps WHERE plan_id = $1 ORDER BY stage_order, step_order`,
    [planId]
  );

  const intakeResult = await pool.query(
    `SELECT title, status, due_date FROM intake_requests WHERE plan_id = $1`,
    [planId]
  );

  const payload = {
    system,
    entityType: 'client_onboarding_plan',
    entityId: planId,
    attributes: {
      clientName: plan.client_name,
      clientCompany: plan.client_company,
      status: plan.status,
      progress: Number(plan.progress ?? 0),
      kickoffTarget: plan.kickoff_target,
      updatedAt: plan.updated_at,
    },
    steps: stepsResult.rows.map((row: any) => ({
      stage: row.stage_name,
      title: row.title,
      status: row.status,
      dueDate: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    })),
    intake: intakeResult.rows.map((row: any) => ({
      title: row.title,
      status: row.status,
      dueDate: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    })),
  };

  logger.debug('Prepared sync payload', { planId, system });

  return payload;
};
