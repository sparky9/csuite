import { PoolClient } from 'pg';
import {
  listPlansInputSchema,
  planGenerateInputSchema,
  planStatusInputSchema,
  Stage,
  StageTask,
} from '../types/onboarding.js';
import { getPool, withTransaction } from '../db/client.js';
import { addDays, toISODate } from '../utils/date.js';
import { logger } from '../utils/logger.js';

const computeDueDate = (planStart: Date, offset: number, fallback?: Date | null) => {
  if (fallback) {
    return toISODate(fallback);
  }

  return toISODate(addDays(planStart, offset));
};

const normalizePlan = (row: any) => ({
  id: row.id,
  userId: row.user_id ?? undefined,
  templateId: row.template_id ?? undefined,
  clientName: row.client_name,
  clientCompany: row.client_company ?? undefined,
  ownerName: row.owner_name ?? undefined,
  status: row.status,
  kickoffTarget: row.kickoff_target ?? undefined,
  progress: Number(row.progress ?? 0),
  summary: row.summary ?? undefined,
  context: row.context ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const summarizeProgress = (steps: any[]) => {
  if (!steps.length) {
    return 0;
  }

  const completed = steps.filter((step) => step.status === 'completed').length;
  return Math.round((completed / steps.length) * 100);
};

export type PlanListItem = {
  id: string;
  templateId?: string;
  clientName: string;
  clientCompany?: string;
  ownerName?: string;
  status: string;
  progress: number;
  kickoffTarget?: string;
  stepCount: number;
  completedSteps: number;
  outstandingIntake: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PlanListResult = {
  total: number;
  limit: number;
  offset: number;
  plans: PlanListItem[];
};

const recordAutomationEvent = async (
  client: PoolClient,
  planId: string,
  eventType: string,
  description: string,
  payload: Record<string, unknown>
) => {
  await client.query(
    `INSERT INTO automation_events (plan_id, event_type, description, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [planId, eventType, description, JSON.stringify(payload)]
  );
};

const insertSteps = async (
  client: PoolClient,
  planId: string,
  stages: Stage[],
  planStart: Date
) => {
  const inserts = stages.flatMap((stage, stageIndex) =>
    stage.tasks.map((task: StageTask, taskIndex: number) => {
      const dueDate = computeDueDate(planStart, task.dueAfterDays);
      return client.query(
        `INSERT INTO onboarding_plan_steps
           (plan_id, stage_order, step_order, stage_name, title, description, due_date, assigned_to, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::jsonb)`,
        [
          planId,
          stageIndex + 1,
          taskIndex + 1,
          stage.name,
          task.title,
          task.description ?? null,
          dueDate,
          task.assignedTo ?? null,
          JSON.stringify({ checklist: task.checklist ?? [] }),
        ]
      );
    })
  );

  await Promise.all(inserts);
};

const insertIntakeRequests = async (
  client: PoolClient,
  planId: string,
  planStart: Date,
  templateRequirements: any[]
) => {
  if (!templateRequirements.length) {
    return;
  }

  const queries = templateRequirements.map((requirement: any) =>
    client.query(
      `INSERT INTO intake_requests
         (plan_id, request_type, title, instructions, due_date)
       VALUES ($1, $2, $3, $4, $5::date)`
        , [
          planId,
          requirement.requestType,
          requirement.title,
          requirement.instructions,
          computeDueDate(planStart, requirement.dueAfterDays ?? 0),
        ]
    )
  );

  await Promise.all(queries);
};

export const generatePlan = async (input: unknown) => {
  const parsed = planGenerateInputSchema.parse(input);
  const { userId, templateId, kickoffPreferences, client, owner, notes } = parsed;

  logger.info('Generating onboarding plan', { userId, templateId, client: client.name });

  let planId: string | null = null;

  await withTransaction(async (clientConn) => {
    const templateResult = await clientConn.query(
      'SELECT * FROM onboarding_templates WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [templateId, userId]
    );

    if (templateResult.rowCount === 0) {
      throw new Error('Template not found or not accessible.');
    }

    const template = templateResult.rows[0];
    const planStart = new Date();
    const kickoffDate = kickoffPreferences?.targetDate ? new Date(kickoffPreferences.targetDate) : null;

    const planInsert = await clientConn.query(
      `INSERT INTO onboarding_plans
         (user_id, template_id, client_name, client_company, owner_name, status, kickoff_target, summary, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::jsonb)
       RETURNING *`,
      [
        userId,
        templateId,
        client.name,
        client.company ?? null,
        owner?.name ?? null,
        'in_progress',
        kickoffDate ? toISODate(kickoffDate) : null,
        notes ?? null,
        JSON.stringify({
          kickoffPreferences: kickoffPreferences ?? {},
          primaryContact: client.primaryContact ?? null,
        }),
      ]
    );

    const planRow = planInsert.rows[0];
    const generatedPlanId: string = planRow.id;
    planId = generatedPlanId;

    await insertSteps(clientConn, generatedPlanId, template.stages, planStart);
    await insertIntakeRequests(clientConn, generatedPlanId, planStart, template.intake_requirements ?? []);

    await recordAutomationEvent(clientConn, generatedPlanId, 'plan_generated', 'Plan generated from template', {
      templateId,
      userId,
      planId: generatedPlanId,
      stageCount: template.stages?.length ?? 0,
      intakeCount: template.intake_requirements?.length ?? 0,
      kickoffTarget: planRow.kickoff_target,
    });

    logger.info('Onboarding plan created', {
      planId: generatedPlanId,
      userId,
      stageCount: template.stages?.length ?? 0,
      intakeCount: template.intake_requirements?.length ?? 0,
    });
  });

  if (!planId) {
    throw new Error('Plan creation failed.');
  }

  return getPlanStatus({ planId });
};

export const listPlans = async (input: unknown): Promise<PlanListResult> => {
  const parsed = listPlansInputSchema.parse(input);
  const { userId, status, search, limit = 20, offset = 0 } = parsed;
  const pool = getPool();

  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let nextIndex = params.length + 1;

  if (status && status.length) {
    conditions.push(`status = ANY($${nextIndex}::text[])`);
    params.push(status);
    nextIndex += 1;
  }

  if (search) {
    const searchIndex = nextIndex;
    params.push(`%${search}%`);
    conditions.push(`(client_name ILIKE $${searchIndex} OR client_company ILIKE $${searchIndex})`);
    nextIndex += 1;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const countResult = await pool.query(`SELECT COUNT(*) FROM onboarding_plans ${whereClause}`, params);
  const total = Number(countResult.rows[0]?.count ?? 0);

  const limitIndex = nextIndex;
  const offsetIndex = nextIndex + 1;
  const dataParams = [...params, limit, offset];

  const dataQuery = `
    SELECT p.*,
      (SELECT COUNT(*) FROM onboarding_plan_steps s WHERE s.plan_id = p.id) AS step_count,
      (SELECT COUNT(*) FROM onboarding_plan_steps s WHERE s.plan_id = p.id AND s.status = 'completed') AS completed_steps,
      (SELECT COUNT(*) FROM intake_requests r WHERE r.plan_id = p.id AND r.status <> 'completed') AS outstanding_intake
    FROM onboarding_plans p
    ${whereClause}
    ORDER BY p.updated_at DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const dataResult = await pool.query(dataQuery, dataParams);

  const plans = dataResult.rows.map((row: any) => ({
    id: row.id,
    templateId: row.template_id ?? undefined,
    clientName: row.client_name,
    clientCompany: row.client_company ?? undefined,
    ownerName: row.owner_name ?? undefined,
    status: row.status,
    progress: Number(row.progress ?? 0),
    kickoffTarget: row.kickoff_target ?? undefined,
    stepCount: Number(row.step_count ?? 0),
    completedSteps: Number(row.completed_steps ?? 0),
    outstandingIntake: Number(row.outstanding_intake ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  logger.debug('Listed onboarding plans', {
    userId,
    status,
    search,
    returned: plans.length,
    total,
    limit,
    offset,
  });

  return {
    total,
    limit,
    offset,
    plans,
  };
};

export const getPlanStatus = async (input: unknown) => {
  const parsed = planStatusInputSchema.parse(input);
  const { planId } = parsed;

  const pool = getPool();
  const planResult = await pool.query('SELECT * FROM onboarding_plans WHERE id = $1', [planId]);

  if (planResult.rowCount === 0) {
    logger.warn('Plan status requested for missing plan', { planId });
    throw new Error('Plan not found.');
  }

  const planRow = planResult.rows[0];

  const stepsResult = await pool.query(
    `SELECT * FROM onboarding_plan_steps WHERE plan_id = $1 ORDER BY stage_order, step_order`,
    [planId]
  );

  const intakeResult = await pool.query(
    `SELECT * FROM intake_requests WHERE plan_id = $1 ORDER BY due_date NULLS LAST`,
    [planId]
  );

  const steps = stepsResult.rows.map((row: any) => ({
    id: row.id,
    stageOrder: row.stage_order,
    stepOrder: row.step_order,
    stageName: row.stage_name,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    blockerNote: row.blocker_note ?? undefined,
    metadata: row.metadata ?? {},
  }));

  const intake = intakeResult.rows.map((row: any) => ({
    id: row.id,
    requestType: row.request_type,
    title: row.title,
    instructions: row.instructions,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    responseData: row.response_data ?? undefined,
    reminderCount: row.reminder_count,
    lastRemindedAt: row.last_reminded_at ?? undefined,
  }));

  const computedProgress = summarizeProgress(steps);

  if (computedProgress !== Number(planRow.progress ?? 0)) {
    await pool.query('UPDATE onboarding_plans SET progress = $2, updated_at = NOW() WHERE id = $1', [
      planId,
      computedProgress,
    ]);
    planRow.progress = computedProgress;
  }

  return {
    plan: normalizePlan(planRow),
    steps,
    intake,
  };
};
