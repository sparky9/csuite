import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generatePlan, getPlanStatus, listPlans } from '../services/plan-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const onboardingPlanGenerateTool: Tool = {
  name: 'onboarding_plan_generate',
  description: 'Generate a new onboarding execution plan from a template.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      templateId: { type: 'string' },
      kickoffPreferences: { type: 'object' },
      client: { type: 'object' },
      owner: { type: 'object' },
      notes: { type: 'string' },
    },
    required: ['userId', 'templateId', 'client'],
  },
};

export const onboardingPlanStatusTool: Tool = {
  name: 'onboarding_plan_status',
  description: 'Retrieve the current status of an onboarding plan, including steps and intake.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
    },
    required: ['planId'],
  },
};

export const onboardingPlanListTool: Tool = {
  name: 'onboarding_plan_list',
  description: 'List onboarding plans for a user with optional status or search filters.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      status: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional status filters (e.g., in_progress, completed).',
      },
      search: {
        type: 'string',
        description: 'Partial match against client name or company.',
      },
      limit: { type: 'number', description: 'Maximum records to return (default 20).' },
      offset: { type: 'number', description: 'Records to skip before returning results.' },
    },
    required: ['userId'],
  },
};

export const handleOnboardingPlanGenerate = async (args: unknown) => {
  const started = Date.now();
  try {
    const result = await generatePlan(args);
    logToolExecution('onboarding_plan_generate', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_plan_generate failed', { error: error.message });
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

export const handleOnboardingPlanStatus = async (args: unknown) => {
  const started = Date.now();
  try {
    const result = await getPlanStatus(args);
    logToolExecution('onboarding_plan_status', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_plan_status failed', { error: error.message });
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

export const handleOnboardingPlanList = async (args: unknown) => {
  const started = Date.now();
  try {
    const result = await listPlans(args);
    logToolExecution('onboarding_plan_list', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_plan_list failed', { error: error.message });
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
