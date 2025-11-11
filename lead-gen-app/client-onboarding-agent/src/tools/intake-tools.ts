import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildIntakeSummary } from '../services/intake-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingIntakeSummaryTool: Tool = {
  name: 'onboarding_intake_summary',
  description: 'Generate a client-facing summary of outstanding onboarding intake items.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      tone: {
        type: 'string',
        enum: ['friendly', 'concise', 'direct'],
        description: 'Tone of the summary message.',
      },
      includeCompleted: {
        type: 'boolean',
        description: 'Whether to include recently completed items.',
      },
    },
    required: ['planId'],
  },
};

export const handleOnboardingIntakeSummary = async (args: unknown) => {
  const started = Date.now();
  try {
    const summary = await buildIntakeSummary(args);
    logToolExecution('onboarding_intake_summary', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...summary }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_intake_summary failed', { error: error.message });
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
