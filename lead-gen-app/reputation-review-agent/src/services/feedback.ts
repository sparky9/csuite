import { query } from '../db/client.js';
import { mapNegativeFeedback, type NegativeFeedbackRow } from '../db/mappers.js';
import type {
  FeedbackSeverity,
  FeedbackStatus,
  IssueCategory,
  NegativeFeedback
} from '../types/reputation.js';

export interface RecordNegativeFeedbackInput {
  userId: string;
  clientId: string;
  feedbackText: string;
  rating: number;
  issueCategory: IssueCategory;
  severity?: FeedbackSeverity;
  status?: FeedbackStatus;
  resolutionNotes?: string | null;
  taskId?: string | null;
}

export async function recordNegativeFeedback(input: RecordNegativeFeedbackInput): Promise<NegativeFeedback> {
  const severity: FeedbackSeverity = input.severity ?? 'medium';
  const status: FeedbackStatus = input.status ?? 'open';
  const resolutionNotes = input.resolutionNotes ?? null;
  const taskId = input.taskId ?? null;

  const result = await query<NegativeFeedbackRow>(
    `INSERT INTO reputation_negative_feedback
      (user_id, client_id, feedback_text, rating, issue_category, severity, status, resolution_notes, task_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.userId,
      input.clientId,
      input.feedbackText,
      input.rating,
      input.issueCategory,
      severity,
      status,
      resolutionNotes,
      taskId
    ]
  );

  return mapNegativeFeedback(result.rows[0]);
}

export interface UpdateFeedbackResolutionInput {
  feedbackId: string;
  status: FeedbackStatus;
  resolutionNotes?: string | null;
  taskId?: string | null;
}

export async function updateFeedbackResolution(
  input: UpdateFeedbackResolutionInput
): Promise<NegativeFeedback> {
  const result = await query<NegativeFeedbackRow>(
    `UPDATE reputation_negative_feedback
     SET status = $2,
         resolution_notes = COALESCE($3, resolution_notes),
         task_id = COALESCE($4, task_id),
         resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.feedbackId, input.status, input.resolutionNotes ?? null, input.taskId ?? null]
  );

  return mapNegativeFeedback(result.rows[0]);
}

export async function getNegativeFeedbackById(
  feedbackId: string
): Promise<NegativeFeedback | null> {
  const result = await query<NegativeFeedbackRow>(
    `SELECT * FROM reputation_negative_feedback WHERE id = $1`,
    [feedbackId]
  );

  const row = result.rows[0];
  return row ? mapNegativeFeedback(row) : null;
}

export interface ListNegativeFeedbackParams {
  userId: string;
  status?: FeedbackStatus;
  limit?: number;
  offset?: number;
}

export async function listNegativeFeedback(
  params: ListNegativeFeedbackParams
): Promise<NegativeFeedback[]> {
  const conditions: string[] = ['user_id = $1'];
  const values: Array<string | number> = [params.userId];
  let idx = values.length + 1;

  if (params.status) {
    conditions.push(`status = $${idx}`);
    values.push(params.status);
    idx += 1;
  }

  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  values.push(limit, offset);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<NegativeFeedbackRow>(
    `SELECT *
     FROM reputation_negative_feedback
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return result.rows.map(mapNegativeFeedback);
}
