import { query } from '../db/client.js';
import { mapTestimonialRequest, type TestimonialRequestRow } from '../db/mappers.js';
import type { DeliveryMethod, RequestStatus, TestimonialRequest } from '../types/reputation.js';
import { addDays, toDate } from '../utils/date.js';

export interface CreateTestimonialRequestInput {
  userId: string;
  clientId: string;
  projectName: string;
  completionDate?: string | Date | null;
  requestTemplate?: string | null;
  deliveryMethod?: DeliveryMethod;
  followUpDays?: number;
}

export async function createTestimonialRequest(
  input: CreateTestimonialRequestInput
): Promise<TestimonialRequest> {
  const completionDate = toDate(input.completionDate);
  const followUpDays = input.followUpDays ?? 7;
  const deliveryMethod: DeliveryMethod = input.deliveryMethod ?? 'email';
  const followUpScheduledAt = addDays(completionDate ?? new Date(), followUpDays);

  const result = await query<TestimonialRequestRow>(
    `INSERT INTO reputation_testimonial_requests
      (user_id, client_id, project_name, completion_date, request_template, delivery_method,
       follow_up_days, follow_up_scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.userId,
      input.clientId,
      input.projectName,
      completionDate,
      input.requestTemplate ?? null,
      deliveryMethod,
      followUpDays,
      followUpScheduledAt
    ]
  );

  return mapTestimonialRequest(result.rows[0]);
}

export async function markTestimonialRequestSent(
  requestId: string
): Promise<TestimonialRequest> {
  const result = await query<TestimonialRequestRow>(
    `UPDATE reputation_testimonial_requests
     SET status = 'sent', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [requestId]
  );

  return mapTestimonialRequest(result.rows[0]);
}

export async function cancelTestimonialRequest(
  requestId: string
): Promise<TestimonialRequest> {
  const result = await query<TestimonialRequestRow>(
    `UPDATE reputation_testimonial_requests
     SET status = 'declined', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [requestId]
  );

  return mapTestimonialRequest(result.rows[0]);
}

export async function getTestimonialRequestById(
  requestId: string
): Promise<TestimonialRequest | null> {
  const result = await query<TestimonialRequestRow>(
    `SELECT * FROM reputation_testimonial_requests WHERE id = $1`,
    [requestId]
  );

  const row = result.rows[0];
  return row ? mapTestimonialRequest(row) : null;
}

export interface ListTestimonialRequestsParams {
  userId: string;
  status?: RequestStatus;
  limit?: number;
  offset?: number;
}

export async function listTestimonialRequests(
  params: ListTestimonialRequestsParams
): Promise<TestimonialRequest[]> {
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

  const result = await query<TestimonialRequestRow>(
    `SELECT *
     FROM reputation_testimonial_requests
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return result.rows.map(mapTestimonialRequest);
}
