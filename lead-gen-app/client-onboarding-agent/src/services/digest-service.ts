import { progressDigestInputSchema } from '../types/onboarding.js';
import { getPool } from '../db/client.js';
import { logger } from '../utils/logger.js';

export const buildProgressDigest = async (input: unknown) => {
  const parsed = progressDigestInputSchema.parse(input);
  const { planId } = parsed;
  const pool = getPool();

  const planResult = await pool.query('SELECT * FROM onboarding_plans WHERE id = $1', [planId]);

  if (planResult.rowCount === 0) {
    throw new Error('Plan not found for progress digest.');
  }

  const plan = planResult.rows[0];

  const stepsResult = await pool.query(
    `SELECT stage_name, status FROM onboarding_plan_steps WHERE plan_id = $1`,
    [planId]
  );

  const intakeResult = await pool.query(
    `SELECT status FROM intake_requests WHERE plan_id = $1`,
    [planId]
  );

  const stageStats = new Map<string, { total: number; completed: number }>();

  stepsResult.rows.forEach((row: any) => {
    const stat = stageStats.get(row.stage_name) ?? { total: 0, completed: 0 };
    stat.total += 1;
    if (row.status === 'completed') {
      stat.completed += 1;
    }
    stageStats.set(row.stage_name, stat);
  });

  const stageSummary = Array.from(stageStats.entries())
    .map(([stage, stat]) => {
      const percent = stat.total ? Math.round((stat.completed / stat.total) * 100) : 0;
      return `${stage}: ${percent}% (${stat.completed}/${stat.total})`;
    })
    .join('\n');

  const outstandingIntake = intakeResult.rows.filter((row: any) => row.status !== 'completed').length;

  const digest = `Client: ${plan.client_name}${plan.client_company ? ` (${plan.client_company})` : ''}\nOverall progress: ${plan.progress ?? 0}%\n\nStage breakdown:\n${stageSummary || 'No steps found.'}\n\nOutstanding intake requests: ${outstandingIntake}`;

  logger.info('Compiled progress digest', { planId, outstandingIntake });

  return {
    planId,
    progress: Number(plan.progress ?? 0),
    outstandingIntake,
    digest,
  };
};
