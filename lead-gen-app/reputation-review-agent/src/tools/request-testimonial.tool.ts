import { z } from 'zod';
import { createTestimonialRequest, markTestimonialRequestSent } from '../services/testimonial-requests.js';
import { ensureUserId } from './helpers.js';
import { registerTool } from './tooling.js';

const isoDateSchema = z
  .string()
  .optional()
  .refine((value: string | undefined) => {
    if (!value) {
      return true;
    }
    return !Number.isNaN(Date.parse(value));
  }, 'completionDate must be an ISO 8601 date string');

const requestTestimonialSchema = z.object({
  userId: z.string().trim().optional(),
  clientId: z.string().min(1, 'clientId is required'),
  projectName: z.string().min(1, 'projectName is required'),
  completionDate: isoDateSchema,
  requestTemplate: z.string().trim().optional(),
  deliveryMethod: z.enum(['email', 'sms', 'both']).optional(),
  followUpDays: z.number().int().min(1).max(60).optional()
});

export const requestTestimonialTool = registerTool({
  name: 'reputation_request_testimonial',
  description: 'Request a testimonial from a client after a project is completed.',
  schema: requestTestimonialSchema,
  execute: async (input) => {
  const userId = ensureUserId(input.userId);

    const created = await createTestimonialRequest({
      userId,
      clientId: input.clientId,
      projectName: input.projectName,
      completionDate: input.completionDate ?? null,
      requestTemplate: input.requestTemplate ?? null,
      deliveryMethod: input.deliveryMethod,
      followUpDays: input.followUpDays
    });

    const sent = await markTestimonialRequestSent(created.id);

    return {
      requestId: sent.id,
      status: 'sent',
      deliveryMethod: sent.deliveryMethod,
      followUpScheduled: sent.followUpScheduledAt?.toISOString() ?? null
    };
  }
});
