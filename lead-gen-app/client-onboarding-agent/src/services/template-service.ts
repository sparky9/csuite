import { PoolClient } from 'pg';
import {
  listTemplatesInputSchema,
  saveTemplateInputSchema,
  TemplatePayload,
} from '../types/onboarding.js';
import { getPool, withTransaction } from '../db/client.js';
import { logger } from '../utils/logger.js';

const normalizeTemplate = (row: any): TemplatePayload & { id: string } => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  category: row.category ?? undefined,
  overview: row.overview ?? undefined,
  timelineDays: row.timeline_days ?? undefined,
  stages: row.stages,
  intakeRequirements: row.intake_requirements ?? [],
  welcomeSequence: row.welcome_sequence ?? [],
  metadata: row.metadata ?? {},
});

export type TemplateListResult = {
  total: number;
  limit: number;
  offset: number;
  templates: Array<TemplatePayload & { id: string }>;
};

const saveTemplateRecord = async (
  client: PoolClient,
  userId: string,
  template: TemplatePayload
) => {
  let targetId = template.id ?? null;

  if (!targetId) {
    const lookup = await client.query(
      'SELECT id FROM onboarding_templates WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
      [userId, template.name]
    );
    targetId = lookup.rows[0]?.id ?? null;
  }

  if (targetId) {
    const updateResult = await client.query(
      `UPDATE onboarding_templates
         SET name = $2,
             description = $3,
             category = $4,
             overview = $5,
             timeline_days = $6,
             stages = $7::jsonb,
             intake_requirements = $8::jsonb,
             welcome_sequence = $9::jsonb,
             metadata = $10::jsonb,
             updated_at = NOW()
       WHERE id = $1 AND user_id = $11
       RETURNING *`,
      [
  targetId,
        template.name,
        template.description ?? null,
        template.category ?? null,
        template.overview ?? null,
        template.timelineDays ?? null,
        JSON.stringify(template.stages),
        JSON.stringify(template.intakeRequirements ?? []),
        JSON.stringify(template.welcomeSequence ?? []),
        JSON.stringify(template.metadata ?? {}),
        userId,
      ]
    );

    if (updateResult.rowCount === 0) {
      throw new Error('Template not found for update.');
    }

    return normalizeTemplate(updateResult.rows[0]);
  }

  const insertResult = await client.query(
    `INSERT INTO onboarding_templates
       (user_id, name, description, category, overview, timeline_days, stages, intake_requirements, welcome_sequence, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
     RETURNING *`,
    [
      userId,
      template.name,
      template.description ?? null,
      template.category ?? null,
      template.overview ?? null,
      template.timelineDays ?? null,
      JSON.stringify(template.stages),
      JSON.stringify(template.intakeRequirements ?? []),
      JSON.stringify(template.welcomeSequence ?? []),
      JSON.stringify(template.metadata ?? {}),
    ]
  );

  return normalizeTemplate(insertResult.rows[0]);
};

export const saveTemplate = async (input: unknown) => {
  const parsed = saveTemplateInputSchema.parse(input);
  const { userId, template } = parsed;

  logger.debug('Saving onboarding template', { userId, templateName: template.name });

  return withTransaction(async (client) => saveTemplateRecord(client, userId, template));
};

export const listTemplates = async (input: unknown): Promise<TemplateListResult> => {
  const parsed = listTemplatesInputSchema.parse(input);
  const { userId, category, search, limit = 20, offset = 0 } = parsed;
  const pool = getPool();

  const params: any[] = [userId];
  const conditions: string[] = ['(user_id = $1 OR user_id IS NULL)'];
  let nextIndex = params.length + 1;

  if (category) {
    conditions.push(`category = $${nextIndex}`);
    params.push(category);
    nextIndex += 1;
  }

  if (search) {
    const searchIndex = nextIndex;
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${searchIndex} OR description ILIKE $${searchIndex})`);
    nextIndex += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const limitIndex = nextIndex;
  const offsetIndex = nextIndex + 1;
  params.push(limit);
  params.push(offset);

  const query = `
    SELECT *, COUNT(*) OVER () AS full_count
    FROM onboarding_templates
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const result = await pool.query(query, params);
  const total = result.rowCount ? Number(result.rows[0].full_count) : 0;
  const templates = result.rows.map(normalizeTemplate);

  logger.debug('Listed onboarding templates', {
    userId,
    category,
    search,
    returned: templates.length,
    total,
    limit,
    offset,
  });

  return {
    total,
    limit,
    offset,
    templates,
  };
};
