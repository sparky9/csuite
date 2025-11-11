import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { listTemplates, saveTemplate } from '../services/template-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingTemplateListTool: Tool = {
  name: 'onboarding_template_list',
  description: 'List client onboarding templates available to the user.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (UUID).' },
      category: { type: 'string', description: 'Optional category filter.' },
      search: { type: 'string', description: 'Optional search term matching name or description.' },
      limit: { type: 'number', description: 'Maximum records to return (default 20).' },
      offset: { type: 'number', description: 'Records to skip before returning results.' },
    },
    required: ['userId'],
  },
};

export const onboardingTemplateSaveTool: Tool = {
  name: 'onboarding_template_save',
  description: 'Create or update a client onboarding template definition.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (UUID).' },
      template: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Existing template identifier.' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          overview: { type: 'string' },
          timelineDays: { type: 'number' },
          stages: { type: 'array', items: { type: 'object' } },
          intakeRequirements: { type: 'array', items: { type: 'object' } },
          welcomeSequence: { type: 'array', items: { type: 'object' } },
          metadata: { type: 'object' },
        },
        required: ['name', 'stages'],
      },
    },
    required: ['userId', 'template'],
  },
};

export const handleOnboardingTemplateList = async (args: unknown) => {
  const started = Date.now();
  try {
    const templates = await listTemplates(args);
    logToolExecution('onboarding_template_list', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...templates }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_template_list failed', { error: error.message });
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

export const handleOnboardingTemplateSave = async (args: unknown) => {
  const started = Date.now();
  try {
    const template = await saveTemplate(args);
    logToolExecution('onboarding_template_save', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, template }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_template_save failed', { error: error.message });
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
