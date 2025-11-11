import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildWelcomeSequence } from '../services/welcome-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingWelcomeSequenceTool: Tool = {
  name: 'onboarding_welcome_sequence',
  description: 'Generate a multi-touch welcome communication plan for a new client.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      communicationMode: {
        type: 'string',
        enum: ['email', 'sms', 'both'],
      },
    },
    required: ['planId'],
  },
};

export const handleOnboardingWelcomeSequence = async (args: unknown) => {
  const started = Date.now();
  try {
    const sequence = await buildWelcomeSequence(args);
    logToolExecution('onboarding_welcome_sequence', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...sequence }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_welcome_sequence failed', { error: error.message });
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
