import { z } from 'zod';
import { query } from '../db/client.js';
import { listTestimonialRequests } from '../services/testimonial-requests.js';
import {
  getReviewFunnelsByTestimonialIds,
  listTestimonials
} from '../services/testimonials.js';
import { ensureUserId } from './helpers.js';
import { registerTool } from './tooling.js';

const listSchema = z.object({
  userId: z.string().trim().optional(),
  filter: z.enum(['all', 'public', 'private', 'pending']).optional(),
  minRating: z.number().min(1).max(5).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

interface TestimonialListItem {
  id: string;
  clientName: string;
  rating: number | null;
  text: string;
  publicUse: boolean;
  reviewCompleted: boolean;
  status: string;
  createdAt: string;
  followUpScheduled?: string | null;
}

async function buildReviewCompletionMap(testimonialIds: string[]): Promise<Set<string>> {
  const funnels = await getReviewFunnelsByTestimonialIds(testimonialIds);
  return new Set(funnels.filter((funnel) => funnel.status === 'completed').map((funnel) => funnel.testimonialId));
}

async function countTestimonialsForFilter(
  userId: string,
  filter: 'all' | 'public' | 'private',
  minRating?: number
): Promise<number> {
  const conditions: string[] = ['user_id = $1'];
  const values: Array<string | number> = [userId];
  let index = 2;

  if (filter === 'public') {
    conditions.push('public_use_approved = true');
  } else if (filter === 'private') {
    conditions.push('public_use_approved = false');
  }

  if (minRating !== undefined) {
    conditions.push(`rating >= $${index}`);
    values.push(minRating);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reputation_testimonials ${whereClause}`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function countPendingRequests(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM reputation_testimonial_requests
     WHERE user_id = $1 AND status IN ('pending', 'sent')`,
    [userId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

function mapTestimonialToListItem(
  testimonial: Awaited<ReturnType<typeof listTestimonials>>[number],
  completedSet: Set<string>
): TestimonialListItem {
  return {
    id: testimonial.id,
    clientName: testimonial.clientName,
    rating: testimonial.rating,
    text: testimonial.testimonialText,
    publicUse: testimonial.publicUseApproved,
    reviewCompleted: completedSet.has(testimonial.id),
    status: 'received',
    createdAt: testimonial.createdAt.toISOString()
  };
}

function mapRequestToPendingItem(
  request: Awaited<ReturnType<typeof listTestimonialRequests>>[number]
): TestimonialListItem {
  return {
    id: request.id,
    clientName: request.clientId,
    rating: null,
    text: request.requestTemplate ?? 'Testimonial request pending',
    publicUse: false,
    reviewCompleted: false,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    followUpScheduled: request.followUpScheduledAt?.toISOString() ?? null
  };
}

export const listTestimonialsTool = registerTool({
  name: 'reputation_list_testimonials',
  description: 'List testimonials with optional filters and review completion status.',
  schema: listSchema,
  execute: async (input) => {
  const userId = ensureUserId(input.userId);
    const limit = input.limit ?? 20;
    const filter = input.filter ?? 'all';

    if (filter === 'pending') {
      const pending = await listTestimonialRequests({ userId, status: 'pending', limit });
      const sent = await listTestimonialRequests({ userId, status: 'sent', limit });
      const combined = [...pending, ...sent]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      const items = combined.map(mapRequestToPendingItem);
      const total = await countPendingRequests(userId);
      return {
        testimonials: items,
        total
      };
    }

    const testimonials = await listTestimonials({ userId, limit: limit * 2 });

    const filtered = testimonials.filter((testimonial) => {
      if (input.minRating && testimonial.rating < input.minRating) {
        return false;
      }
      if (filter === 'public') {
        return testimonial.publicUseApproved;
      }
      if (filter === 'private') {
        return !testimonial.publicUseApproved;
      }
      return true;
    });

    const trimmed = filtered.slice(0, limit);
    const completedSet = await buildReviewCompletionMap(trimmed.map((item) => item.id));

    const items = trimmed.map((testimonial) => mapTestimonialToListItem(testimonial, completedSet));

    const total = await countTestimonialsForFilter(userId, filter, input.minRating);

    return {
      testimonials: items,
      total
    };
  }
});
