import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { proposeKickoffSchedule } from '../services/kickoff-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingKickoffScheduleTool: Tool = {
  name: 'onboarding_kickoff_schedule',
  description: 'Generate kickoff meeting recommendations based on availability windows.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      teamAvailability: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            slots: { type: 'array', items: { type: 'string' } },
          },
          required: ['date', 'slots'],
        },
      },
      clientAvailability: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            slots: { type: 'array', items: { type: 'string' } },
          },
          required: ['date', 'slots'],
        },
      },
    },
    required: ['planId', 'teamAvailability', 'clientAvailability'],
  },
};

export const handleOnboardingKickoffSchedule = async (args: unknown) => {
  const started = Date.now();
  try {
    const proposal = await proposeKickoffSchedule(args);
    logToolExecution('onboarding_kickoff_schedule', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...proposal }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_kickoff_schedule failed', { error: error.message });
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
