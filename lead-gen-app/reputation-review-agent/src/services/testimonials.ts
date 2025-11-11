import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db/client.js';
import {
  mapReviewFunnel,
  mapTestimonial,
  type ReviewFunnelRow,
  type TestimonialRequestRow,
  type TestimonialRow
} from '../db/mappers.js';
import type {
  ReviewFunnel,
  ReviewPlatform,
  ReviewStatus,
  Testimonial
} from '../types/reputation.js';

export interface RecordTestimonialInput {
  requestId?: string | null;
  userId: string;
  clientId: string;
  clientName: string;
  clientTitle?: string | null;
  clientCompany?: string | null;
  testimonialText: string;
  rating?: number;
  permissionGranted?: boolean;
  receivedDate?: string | Date;
  publicUseApproved?: boolean;
}

export async function recordTestimonial(input: RecordTestimonialInput): Promise<Testimonial> {
  const receivedDate = input.receivedDate ? new Date(input.receivedDate) : new Date();
  const rating = input.rating ?? 5;
  const permissionGranted = input.permissionGranted ?? false;
  const publicUseApproved = input.publicUseApproved ?? permissionGranted;

  return withTransaction(async (client: PoolClient) => {
    const testimonialResult = await client.query<TestimonialRow>(
      `INSERT INTO reputation_testimonials
        (request_id, user_id, client_id, client_name, client_title, client_company, testimonial_text,
         rating, permission_granted, received_date, public_use_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.requestId ?? null,
        input.userId,
        input.clientId,
        input.clientName,
        input.clientTitle ?? null,
        input.clientCompany ?? null,
        input.testimonialText,
        rating,
        permissionGranted,
        receivedDate,
        publicUseApproved
      ]
    );

    if (input.requestId) {
      await client.query<TestimonialRequestRow>(
        `UPDATE reputation_testimonial_requests
         SET status = 'received', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.requestId]
      );
    }

    return mapTestimonial(testimonialResult.rows[0]);
  });
}

export interface CreateReviewFunnelInput {
  testimonialId: string;
  userId: string;
  platform: ReviewPlatform;
  businessProfileUrl: string;
  messageTemplate?: string | null;
}

export async function createReviewFunnel(input: CreateReviewFunnelInput): Promise<ReviewFunnel> {
  const result = await query<ReviewFunnelRow>(
    `INSERT INTO reputation_review_funnels
      (testimonial_id, user_id, platform, business_profile_url, message_template)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.testimonialId,
      input.userId,
      input.platform,
      input.businessProfileUrl,
      input.messageTemplate ?? null
    ]
  );

  return mapReviewFunnel(result.rows[0]);
}

export interface UpdateReviewStatusInput {
  funnelId: string;
  status: ReviewStatus;
  reviewUrl?: string | null;
  publicRating?: number | null;
}

export async function updateReviewStatus(input: UpdateReviewStatusInput): Promise<ReviewFunnel> {
  const result = await query<ReviewFunnelRow>(
    `UPDATE reputation_review_funnels
     SET status = $2,
         review_url = COALESCE($3, review_url),
         public_rating = COALESCE($4, public_rating),
         completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.funnelId, input.status, input.reviewUrl ?? null, input.publicRating ?? null]
  );

  return mapReviewFunnel(result.rows[0]);
}

export async function getTestimonialById(id: string): Promise<Testimonial | null> {
  const result = await query<TestimonialRow>(
    `SELECT * FROM reputation_testimonials WHERE id = $1`,
    [id]
  );

  const row = result.rows[0];
  return row ? mapTestimonial(row) : null;
}

export interface ListTestimonialsParams {
  userId: string;
  requestId?: string;
  limit?: number;
  offset?: number;
}

export async function listTestimonials(params: ListTestimonialsParams): Promise<Testimonial[]> {
  const conditions: string[] = ['user_id = $1'];
  const values: Array<string | number> = [params.userId];
  let idx = values.length + 1;

  if (params.requestId) {
    conditions.push(`request_id = $${idx}`);
    values.push(params.requestId);
    idx += 1;
  }

  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  values.push(limit, offset);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<TestimonialRow>(
    `SELECT *
     FROM reputation_testimonials
     ${whereClause}
     ORDER BY received_date DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return result.rows.map(mapTestimonial);
}

export async function getReviewFunnelById(id: string): Promise<ReviewFunnel | null> {
  const result = await query<ReviewFunnelRow>(
    `SELECT * FROM reputation_review_funnels WHERE id = $1`,
    [id]
  );

  const row = result.rows[0];
  return row ? mapReviewFunnel(row) : null;
}

export interface ListReviewFunnelsParams {
  userId: string;
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}

export async function listReviewFunnels(params: ListReviewFunnelsParams): Promise<ReviewFunnel[]> {
  const conditions: string[] = ['user_id = $1'];
  const values: Array<string | number> = [params.userId];
  let idx = values.length + 1;

  if (params.status) {
    conditions.push(`status = $${idx}`);
    values.push(params.status);
    idx += 1;
  }

  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  values.push(limit, offset);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<ReviewFunnelRow>(
    `SELECT *
     FROM reputation_review_funnels
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return result.rows.map(mapReviewFunnel);
}

export async function getReviewFunnelsByTestimonialIds(
  testimonialIds: string[]
): Promise<ReviewFunnel[]> {
  if (!testimonialIds.length) {
    return [];
  }

  const result = await query<ReviewFunnelRow>(
    `SELECT *
     FROM reputation_review_funnels
     WHERE testimonial_id = ANY($1::uuid[])`,
    [testimonialIds]
  );

  return result.rows.map(mapReviewFunnel);
}
