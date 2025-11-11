import { z } from 'zod';
import { registerTool } from './tooling.js';
import { getInvoiceStatus } from '../services/invoices.js';

const schema = z.object({
  invoiceId: z.string().uuid('invoiceId must be a valid UUID.')
});

export const billingTrackInvoiceStatusTool = registerTool({
  name: 'billing_track_invoice_status',
  description: 'Retrieve the latest status, amounts due, and timeline for a specific invoice.',
  schema,
  execute: async (input) => {
    const status = await getInvoiceStatus(input.invoiceId);

    return {
      invoice: {
        invoiceId: status.invoiceId,
        invoiceNumber: status.invoiceNumber,
        status: status.status,
        sentAt: status.sentAt,
        viewedAt: status.viewedAt,
        dueDate: status.dueDate,
        daysOverdue: status.daysOverdue,
        total: status.total,
        amountPaid: status.amountPaid,
        amountDue: status.amountDue
      }
    };
  }
});
