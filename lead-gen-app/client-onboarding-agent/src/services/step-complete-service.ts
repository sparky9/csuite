import { PoolClient } from 'pg';
import { z } from 'zod';
import { getPool, withTransaction } from '../db/client.js';
import { logger } from '../utils/logger.js';

/**
 * Input schema for completing a step
 */
const stepCompleteInputSchema = z.object({
  planId: z.string().uuid(),
  stepId: z.string().uuid(),
  completedBy: z.string().min(1),
  completionNotes: z.string().optional(),
});

/**
 * Input schema for submitting intake response
 */
const intakeSubmitInputSchema = z.object({
  intakeRequestId: z.string().uuid(),
  responses: z.record(z.string()),
  userId: z.string().uuid().optional(), // Optional - defaults to plan owner if not provided
});

/**
 * Mark a step as completed
 */
export const completeStep = async (args: unknown) => {
  const input = stepCompleteInputSchema.parse(args);

  return withTransaction(async (client: PoolClient) => {
    // Check if step exists and belongs to the plan
    const stepCheck = await client.query(
      `SELECT id, plan_id, title, status
       FROM onboarding_plan_steps
       WHERE id = $1 AND plan_id = $2`,
      [input.stepId, input.planId]
    );

    if (stepCheck.rows.length === 0) {
      throw new Error(`Step ${input.stepId} not found in plan ${input.planId}`);
    }

    const step = stepCheck.rows[0];

    if (step.status === 'completed') {
      logger.warn('Step already completed', { stepId: input.stepId });
      // Return current state but don't fail
    }

    // Update step to completed
    const completedAt = new Date();
    await client.query(
      `UPDATE onboarding_plan_steps
       SET status = 'completed',
           completed_at = $1,
           completed_by = $2,
           completion_notes = $3
       WHERE id = $4`,
      [completedAt, input.completedBy, input.completionNotes || null, input.stepId]
    );

    // Recalculate plan progress
    const progressResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) AS total
       FROM onboarding_plan_steps
       WHERE plan_id = $1`,
      [input.planId]
    );

    const progressRow = progressResult.rows[0];
    const completed = parseInt(progressRow.completed || '0');
    const total = parseInt(progressRow.total || '0');

    // Guard against division by zero when plan has no steps
    const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Update plan progress
    await client.query(
      `UPDATE onboarding_plans
       SET progress = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [progressPercent, input.planId]
    );

    // Log automation event
    await client.query(
      `INSERT INTO automation_events (plan_id, event_type, description, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        input.planId,
        'step_completed',
        `Step "${step.title}" marked completed by ${input.completedBy}`,
        JSON.stringify({
          stepId: input.stepId,
          completedBy: input.completedBy,
          completionNotes: input.completionNotes
        })
      ]
    );

    logger.info('Step completed', {
      stepId: input.stepId,
      planId: input.planId,
      completedBy: input.completedBy,
      newProgress: `${progressPercent}%`
    });

    return {
      stepId: input.stepId,
      status: 'completed',
      completedAt: completedAt.toISOString(),
      planProgress: `${progressPercent}%`
    };
  });
};

/**
 * Submit intake response
 */
export const submitIntakeResponse = async (args: unknown) => {
  const input = intakeSubmitInputSchema.parse(args);

  return withTransaction(async (client: PoolClient) => {
    // Check if intake request exists and get plan owner
    const intakeCheck = await client.query(
      `SELECT ir.id, ir.plan_id, ir.title, ir.status, p.client_name, p.user_id
       FROM intake_requests ir
       JOIN onboarding_plans p ON p.id = ir.plan_id
       WHERE ir.id = $1`,
      [input.intakeRequestId]
    );

    if (intakeCheck.rows.length === 0) {
      throw new Error(`Intake request ${input.intakeRequestId} not found`);
    }

    const intakeRequest = intakeCheck.rows[0];

    // Default to plan owner if userId not provided
    const submittingUserId = input.userId || intakeRequest.user_id;

    if (intakeRequest.status === 'submitted') {
      logger.warn('Intake already submitted', { intakeRequestId: input.intakeRequestId });
      // Allow resubmission to update responses
    }

    // Delete existing responses (if resubmitting)
    await client.query(
      `DELETE FROM intake_responses
       WHERE intake_request_id = $1`,
      [input.intakeRequestId]
    );

    // Insert individual field responses
    const submittedAt = new Date();
    for (const [fieldName, fieldValue] of Object.entries(input.responses)) {
      await client.query(
        `INSERT INTO intake_responses (intake_request_id, user_id, field_name, field_value, submitted_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.intakeRequestId, submittingUserId, fieldName, fieldValue, submittedAt]
      );
    }

    // Update intake request status
    await client.query(
      `UPDATE intake_requests
       SET status = 'submitted',
           submitted_at = $1,
           submitted_by = $2,
           response_data = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [submittedAt, submittingUserId, JSON.stringify(input.responses), input.intakeRequestId]
    );

    // Determine next steps based on plan context
    const nextSteps = ['kickoff_scheduling']; // Default next step

    // Check if all intake requests for this plan are complete
    const remainingIntake = await client.query(
      `SELECT COUNT(*) as pending_count
       FROM intake_requests
       WHERE plan_id = $1 AND status != 'submitted'`,
      [intakeRequest.plan_id]
    );

    const allIntakeComplete = parseInt(remainingIntake.rows[0].pending_count) === 0;

    if (allIntakeComplete) {
      nextSteps.push('all_intake_complete');

      // Update plan status if still in intake phase
      await client.query(
        `UPDATE onboarding_plans
         SET status = CASE
           WHEN status = 'intake_pending' THEN 'intake_complete'
           ELSE status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [intakeRequest.plan_id]
      );
    }

    // Log automation event
    await client.query(
      `INSERT INTO automation_events (plan_id, event_type, description, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        intakeRequest.plan_id,
        'intake_submitted',
        `Intake "${intakeRequest.title}" submitted by ${submittingUserId}`,
        JSON.stringify({
          intakeRequestId: input.intakeRequestId,
          submittedBy: submittingUserId,
          fieldCount: Object.keys(input.responses).length,
          allIntakeComplete
        })
      ]
    );

    logger.info('Intake response submitted', {
      intakeRequestId: input.intakeRequestId,
      userId: submittingUserId,
      fieldCount: Object.keys(input.responses).length,
      allIntakeComplete
    });

    return {
      intakeRequestId: input.intakeRequestId,
      status: 'submitted',
      submittedAt: submittedAt.toISOString(),
      nextSteps
    };
  });
};
