import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SignatureRemindInputSchema } from '../types/tools.js';
import { reminderService } from '../services/reminder-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const signatureRemindTool: Tool = {
  name: 'signature_remind',
  description: 'Generate a reminder memo for outstanding contract signers.',
  inputSchema: {
    type: 'object',
    properties: {
      contractId: { type: 'string', description: 'Contract identifier.' },
      contactId: { type: 'string', description: 'Target a specific signer (optional).' },
      reminderType: {
        type: 'string',
        enum: ['first', 'second', 'final'],
        description: 'Reminder stage label.',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'friendly', 'firm'],
        description: 'Tone for the reminder copy.',
      },
    },
    required: ['contractId'],
  },
};

export async function handleSignatureRemind(args: unknown) {
  const started = Date.now();
  try {
    const params = SignatureRemindInputSchema.parse(args ?? {});
    const reminder = await reminderService.generateReminder(params);
    logToolExecution('signature_remind', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              memo: reminder.memo,
              targetedContacts: reminder.targetedContacts,
              contractId: reminder.contract.id,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('signature_remind failed', { error: error.message });
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
}
