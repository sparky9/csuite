import type { PoolClient } from 'pg';
import { getDbPool, withTransaction } from '../db/client.js';
import type { ProposalTemplate } from '../types/entities.js';

function mapTemplateRow(row: any): ProposalTemplate {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    body: row.body,
    requiredTokens: row.required_tokens ?? [],
    optionalTokens: row.optional_tokens ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class TemplateService {
  async listTemplates(params: { userId?: string; category?: string; search?: string }): Promise<ProposalTemplate[]> {
    const pool = getDbPool();
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (params.userId) {
      values.push(params.userId);
      conditions.push(`(user_id = $${values.length} OR user_id IS NULL)`);
    }
    if (params.category) {
      values.push(params.category.toLowerCase());
      conditions.push(`LOWER(category) = $${values.length}`);
    }
    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${values.length} OR LOWER(description) LIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, user_id, name, description, category, body, required_tokens, optional_tokens, metadata, created_at, updated_at
       FROM proposal_templates
       ${whereClause}
       ORDER BY updated_at DESC
       LIMIT 50`,
      values
    );

    return result.rows.map(mapTemplateRow);
  }

  async getTemplateById(templateId: string): Promise<ProposalTemplate | null> {
    const pool = getDbPool();
    const result = await pool.query(
      `SELECT id, user_id, name, description, category, body, required_tokens, optional_tokens, metadata, created_at, updated_at
       FROM proposal_templates
       WHERE id = $1
       LIMIT 1`,
      [templateId]
    );

    const row = result.rows[0];
    return row ? mapTemplateRow(row) : null;
  }

  async getTemplateByName(userId: string | undefined, name: string): Promise<ProposalTemplate | null> {
    const pool = getDbPool();
    const result = await pool.query(
      `SELECT id, user_id, name, description, category, body, required_tokens, optional_tokens, metadata, created_at, updated_at
       FROM proposal_templates
       WHERE user_id IS NOT DISTINCT FROM $1 AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [userId ?? null, name]
    );

    const row = result.rows[0];
    return row ? mapTemplateRow(row) : null;
  }

  private async updateTemplate(
    client: PoolClient,
    id: string,
    payload: {
      description?: string;
      category?: string;
      body?: string;
      requiredTokens?: string[];
      optionalTokens?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<ProposalTemplate> {
    const result = await client.query(
      `UPDATE proposal_templates
       SET
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         body = COALESCE($4, body),
         required_tokens = COALESCE($5, required_tokens),
         optional_tokens = COALESCE($6, optional_tokens),
         metadata = COALESCE($7, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, name, description, category, body, required_tokens, optional_tokens, metadata, created_at, updated_at`,
      [
        id,
        payload.description ?? null,
        payload.category ?? null,
        payload.body ?? null,
        payload.requiredTokens ?? null,
        payload.optionalTokens ?? null,
        payload.metadata ?? null,
      ]
    );

    return mapTemplateRow(result.rows[0]);
  }

  private async insertTemplate(
    client: PoolClient,
    payload: {
      userId?: string;
      name: string;
      description?: string;
      category?: string;
      body: string;
      requiredTokens?: string[];
      optionalTokens?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<ProposalTemplate> {
    const result = await client.query(
      `INSERT INTO proposal_templates (user_id, name, description, category, body, required_tokens, optional_tokens, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, name, description, category, body, required_tokens, optional_tokens, metadata, created_at, updated_at`,
      [
        payload.userId ?? null,
        payload.name,
        payload.description ?? null,
        payload.category ?? null,
        payload.body,
        payload.requiredTokens ?? [],
        payload.optionalTokens ?? [],
        payload.metadata ?? {},
      ]
    );

    return mapTemplateRow(result.rows[0]);
  }

  async saveTemplate(payload: {
    userId?: string;
    name: string;
    description?: string;
    category?: string;
    body: string;
    requiredTokens?: string[];
    optionalTokens?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<ProposalTemplate> {
    return withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM proposal_templates WHERE user_id IS NOT DISTINCT FROM $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
        [payload.userId ?? null, payload.name]
      );

      if (existing.rows[0]) {
        return this.updateTemplate(client, existing.rows[0].id, payload);
      }

      return this.insertTemplate(client, payload);
    });
  }
}

export const templateService = new TemplateService();
