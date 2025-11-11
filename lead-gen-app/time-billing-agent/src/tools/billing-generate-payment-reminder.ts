import { z } from 'zod';
import { registerTool } from './tooling.js';
import { generatePaymentReminder } from '../services/payments.js';

const schema = z.object({
  invoiceId: z.string().uuid('invoiceId must be a valid UUID.'),
  tone: z.enum(['friendly', 'firm', 'urgent']).optional()
});

export const billingGeneratePaymentReminderTool = registerTool({
  name: 'billing_generate_payment_reminder',
  description: 'Draft a payment reminder email for an outstanding invoice with tone guidance.',
  schema,
  execute: async (input) => {
    const result = await generatePaymentReminder({
      invoiceId: input.invoiceId,
      tone: input.tone
    });

    return {
      reminder: {
        reminderId: result.reminderId,
        invoiceNumber: result.invoiceNumber,
        tone: result.tone,
        subject: result.subject,
        messageBody: result.messageBody,
        suggestedSendDate: result.suggestedSendDate
      }
    };
  }
});
