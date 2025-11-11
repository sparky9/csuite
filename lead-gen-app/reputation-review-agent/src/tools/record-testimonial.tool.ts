import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getTestimonialRequestById } from '../services/testimonial-requests.js';
import { recordTestimonial } from '../services/testimonials.js';
import { ensureUserId } from './helpers.js';
import { registerTool } from './tooling.js';

const isoDateSchema = z.string().refine((value: string) => !Number.isNaN(Date.parse(value)), {
  message: 'receivedDate must be an ISO 8601 date string'
});

const recordTestimonialSchema = z.object({
  userId: z.string().trim().optional(),
  requestId: z.string().uuid('requestId must be a valid UUID'),
  testimonialText: z.string().min(10, 'testimonialText must include meaningful feedback'),
  rating: z.number().min(1).max(5),
  clientName: z.string().min(1, 'clientName is required'),
  clientTitle: z.string().trim().optional(),
  clientCompany: z.string().trim().optional(),
  permissionGranted: z.boolean(),
  receivedDate: isoDateSchema
});

export const recordTestimonialTool = registerTool({
  name: 'reputation_record_testimonial',
  description: 'Record a client testimonial with rating and public usage permissions.',
  schema: recordTestimonialSchema,
  execute: async (input) => {
    const request = await getTestimonialRequestById(input.requestId);
    if (!request) {
      throw new McpError(ErrorCode.InvalidParams, 'Testimonial request not found');
    }

  const userId = ensureUserId(input.userId ?? request.userId);

    const testimonial = await recordTestimonial({
      requestId: request.id,
      userId,
      clientId: request.clientId,
      clientName: input.clientName,
      clientTitle: input.clientTitle ?? null,
      clientCompany: input.clientCompany ?? null,
      testimonialText: input.testimonialText,
      rating: input.rating,
      permissionGranted: input.permissionGranted,
      receivedDate: input.receivedDate,
      publicUseApproved: input.permissionGranted
    });

    return {
      testimonialId: testimonial.id,
      status: 'recorded',
      publicUseApproved: testimonial.publicUseApproved,
      nextAction: 'funnel_to_review_site'
    };
  }
});
