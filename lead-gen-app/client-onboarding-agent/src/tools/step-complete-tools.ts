import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { completeStep, submitIntakeResponse } from '../services/step-complete-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

/**
 * Tool: Mark onboarding step as completed
 */
export const onboardingStepCompleteTool: Tool = {
  name: 'onboarding_step_complete',
  description: 'Mark an onboarding step as completed with optional completion notes.',
  inputSchema: {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'UUID of the onboarding plan'
      },
      stepId: {
        type: 'string',
        description: 'UUID of the step to mark as completed'
      },
      completedBy: {
        type: 'string',
        description: 'User who completed the step (email or user ID)'
      },
      completionNotes: {
        type: 'string',
        description: 'Optional notes about how the step was completed'
      },
    },
    required: ['planId', 'stepId', 'completedBy'],
  },
};

/**
 * Tool: Submit intake response
 */
export const onboardingIntakeSubmitTool: Tool = {
  name: 'onboarding_intake_submit',
  description: 'Submit intake response with field answers.',
  inputSchema: {
    type: 'object',
    properties: {
      intakeRequestId: {
        type: 'string',
        description: 'UUID of the intake request'
      },
      responses: {
        type: 'object',
        description: 'Key-value pairs of field answers',
        additionalProperties: { type: 'string' }
      },
      userId: {
        type: 'string',
        description: 'User submitting the response (optional - defaults to plan owner)'
      },
    },
    required: ['intakeRequestId', 'responses'],
  },
};

/**
 * Handler for onboarding_step_complete
 */
export const handleOnboardingStepComplete = async (args: unknown) => {
  const started = Date.now();
  try {
    const result = await completeStep(args);
    logToolExecution('onboarding_step_complete', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_step_complete failed', { error: error.message });
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

/**
 * Handler for onboarding_intake_submit
 */
export const handleOnboardingIntakeSubmit = async (args: unknown) => {
  const started = Date.now();
  try {
    const result = await submitIntakeResponse(args);
    logToolExecution('onboarding_intake_submit', args, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('onboarding_intake_submit failed', { error: error.message });
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
