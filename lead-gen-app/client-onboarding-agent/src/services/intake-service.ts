import { intakeSummaryInputSchema } from '../types/onboarding.js';
import { getPool } from '../db/client.js';
import { logger } from '../utils/logger.js';

const toneTemplates: Record<string, { greeting: string; closing: string }> = {
  friendly: {
    greeting: "Hope you're doing well! We just need a couple of quick items to keep onboarding moving.",
    closing: 'Appreciate your help keeping things on track. Reach out if anything is unclear!',
  },
  concise: {
    greeting: 'Quick reminder on the remaining onboarding items:',
    closing: 'Thanks for the fast follow-up.',
  },
  direct: {
    greeting: 'We need the items below to proceed with onboarding:',
    closing: 'Let us know once complete so we can advance the next milestone.',
  },
};

export const buildIntakeSummary = async (input: unknown) => {
  const parsed = intakeSummaryInputSchema.parse(input);
  const { planId, tone, includeCompleted } = parsed;
  const pool = getPool();

  const planResult = await pool.query(
    'SELECT client_name, client_company FROM onboarding_plans WHERE id = $1',
    [planId]
  );

  if (planResult.rowCount === 0) {
    logger.warn('Intake summary requested for missing plan', { planId });
    throw new Error('Plan not found for intake summary.');
  }

  const requestsResult = await pool.query(
    `SELECT * FROM intake_requests WHERE plan_id = $1 ORDER BY due_date NULLS LAST, created_at`,
    [planId]
  );

  const outstanding = requestsResult.rows.filter((row: any) => row.status !== 'completed');
  const completed = requestsResult.rows.filter((row: any) => row.status === 'completed');

  const sections: string[] = [];
  const toneConfig = toneTemplates[tone] ?? toneTemplates.friendly;

  sections.push(toneConfig.greeting);

  if (outstanding.length) {
    const list = outstanding
      .map((row: any) => {
        const dueDate = row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null;
        const due = dueDate ? ` (due ${dueDate})` : '';
        return `• ${row.title}${due}\n  ${row.instructions}`;
      })
      .join('\n');
    sections.push(list);
  } else {
    sections.push('There are no outstanding tasks at this time. Great job staying ahead!');
  }

  if (includeCompleted && completed.length) {
    const doneList = completed
      .map((row: any) => `• ${row.title}`)
      .join('\n');
    sections.push('\nCompleted recently:\n' + doneList);
  }

  sections.push('\n' + toneConfig.closing);

  logger.debug('Generated intake summary', { planId, outstanding: outstanding.length });

  return {
    planId,
    outstandingCount: outstanding.length,
    completedCount: completed.length,
    message: sections.join('\n\n').trim(),
  };
};
