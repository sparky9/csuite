import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getTestimonialRequestById } from '../services/testimonial-requests.js';
import { createReviewFunnel, getTestimonialById } from '../services/testimonials.js';
import { ensureUserId } from './helpers.js';
import { registerTool } from './tooling.js';

const funnelSchema = z.object({
  userId: z.string().trim().optional(),
  testimonialId: z.string().uuid('testimonialId must be a valid UUID'),
  platform: z.enum(['google', 'yelp', 'trustpilot', 'facebook']),
  businessProfileUrl: z.string().url('businessProfileUrl must be a valid URL')
});

function buildMessageTemplate(
  clientName: string,
  platform: string,
  requestProject?: string | null
): string {
  const firstName = clientName.split(' ')[0] ?? clientName;
  const projectLine = requestProject ? ` about ${requestProject}` : '';

  return (
    `Hi ${firstName}, thanks again for sharing your testimonial${projectLine}! ` +
    `Would you mind copying it to ${platform.charAt(0).toUpperCase()}${platform.slice(1)} so others can see it too?`
  );
}

export const funnelToReviewSiteTool = registerTool({
  name: 'reputation_funnel_to_review_site',
  description: 'Create a review funnel record and generate a personalized follow-up message.',
  schema: funnelSchema,
  execute: async (input) => {
    const testimonial = await getTestimonialById(input.testimonialId);
    if (!testimonial) {
      throw new McpError(ErrorCode.InvalidParams, 'Testimonial not found');
    }

  const userId = ensureUserId(input.userId ?? testimonial.userId);
    const request = testimonial.requestId
      ? await getTestimonialRequestById(testimonial.requestId)
      : null;

    const messageTemplate = buildMessageTemplate(
      testimonial.clientName,
      input.platform,
      request?.projectName
    );

    const funnel = await createReviewFunnel({
      testimonialId: testimonial.id,
      userId,
      platform: input.platform,
      businessProfileUrl: input.businessProfileUrl,
      messageTemplate
    });

    return {
      funnelId: funnel.id,
      platform: funnel.platform,
      messageTemplate,
      reviewLink: funnel.businessProfileUrl,
      status: 'ready_to_send'
    };
  }
});
