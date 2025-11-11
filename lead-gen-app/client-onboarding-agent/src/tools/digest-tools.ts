import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildProgressDigest } from '../services/digest-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingProgressDigestTool: Tool = {
  name: 'onboarding_progress_digest',
  description: 'Summarize onboarding progress for internal stakeholders.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
    },
    required: ['planId'],
  },
};

export const handleOnboardingProgressDigest = async (args: unknown) => {
  const started = Date.now();
  try {
    const digest = await buildProgressDigest(args);
    logToolExecution('onboarding_progress_digest', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...digest }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_progress_digest failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
};
