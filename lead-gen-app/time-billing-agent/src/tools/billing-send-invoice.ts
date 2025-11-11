import { z } from 'zod';
import { registerTool } from './tooling.js';
import { sendInvoice } from '../services/invoices.js';

const schema = z.object({
  invoiceId: z.string().uuid('invoiceId must be a valid UUID.'),
  deliveryMethod: z.enum(['email', 'mail', 'portal']).optional(),
  recipientEmail: z.string().email().optional()
});

export const billingSendInvoiceTool = registerTool({
  name: 'billing_send_invoice',
  description: 'Mark an invoice as sent and optionally record how it was delivered.',
  schema,
  execute: async (input) => {
    const result = await sendInvoice({
      invoiceId: input.invoiceId,
      deliveryMethod: input.deliveryMethod,
      recipientEmail: input.recipientEmail
    });

    return {
      message: 'Invoice marked as sent.',
      invoice: {
        invoiceId: result.invoiceId,
        status: result.status,
        sentAt: result.sentAt,
        deliveryMethod: result.deliveryMethod,
        trackingEnabled: result.trackingEnabled
      }
    };
  }
});
