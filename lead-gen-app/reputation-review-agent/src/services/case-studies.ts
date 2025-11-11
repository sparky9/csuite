import { query } from '../db/client.js';
import { mapCaseStudy, type CaseStudyRow } from '../db/mappers.js';
import type { CaseStudy, CaseStudyFormat } from '../types/reputation.js';

export interface GenerateCaseStudyInput {
  testimonialId: string;
  userId: string;
  format: CaseStudyFormat;
  content: string;
  metricsIncluded?: boolean;
  downloadUrl?: string | null;
}

export async function generateCaseStudy(input: GenerateCaseStudyInput): Promise<CaseStudy> {
  const metricsIncluded = input.metricsIncluded ?? true;

  const result = await query<CaseStudyRow>(
    `INSERT INTO reputation_case_studies (testimonial_id, user_id, format, content, metrics_included, download_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.testimonialId,
      input.userId,
      input.format,
      input.content,
      metricsIncluded,
      input.downloadUrl ?? null
    ]
  );

  return mapCaseStudy(result.rows[0]);
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  const result = await query<CaseStudyRow>(
    `SELECT * FROM reputation_case_studies WHERE id = $1`,
    [id]
  );

  const row = result.rows[0];
  return row ? mapCaseStudy(row) : null;
}

export interface ListCaseStudiesParams {
  userId: string;
  limit?: number;
  offset?: number;
}

export async function listCaseStudies(params: ListCaseStudiesParams): Promise<CaseStudy[]> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const result = await query<CaseStudyRow>(
    `SELECT *
     FROM reputation_case_studies
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [params.userId, limit, offset]
  );

  return result.rows.map(mapCaseStudy);
}
