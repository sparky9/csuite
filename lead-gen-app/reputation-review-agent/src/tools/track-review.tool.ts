import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getReviewFunnelById } from '../services/testimonials.js';
import { registerTool } from './tooling.js';

const trackSchema = z.object({
  funnelId: z.string().uuid('funnelId must be a valid UUID')
});

const statusMap: Record<string, string> = {
  ready: 'ready_to_send',
  sent: 'sent',
  completed: 'completed',
  declined: 'declined'
};

export const trackReviewStatusTool = registerTool({
  name: 'reputation_track_review_status',
  description: 'Retrieve the latest status for a public review funnel.',
  schema: trackSchema,
  execute: async (input) => {
    const funnel = await getReviewFunnelById(input.funnelId);
    if (!funnel) {
      throw new McpError(ErrorCode.InvalidParams, 'Review funnel not found');
    }

    const status = statusMap[funnel.status] ?? funnel.status;

    return {
      funnelId: funnel.id,
      platform: funnel.platform,
      status,
      reviewUrl: funnel.reviewUrl,
      publicRating: funnel.publicRating,
      completedAt: funnel.completedAt ? funnel.completedAt.toISOString() : null
    };
  }
});
