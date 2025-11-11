import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildSyncUpdate } from '../services/sync-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingSyncUpdateTool: Tool = {
  name: 'onboarding_sync_update',
  description: 'Prepare a CRM/PM sync payload with the latest onboarding status.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      system: { type: 'string' },
    },
    required: ['planId', 'system'],
  },
};

export const handleOnboardingSyncUpdate = async (args: unknown) => {
  const started = Date.now();
  try {
    const payload = await buildSyncUpdate(args);
    logToolExecution('onboarding_sync_update', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, payload }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_sync_update failed', { error: error.message });
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
