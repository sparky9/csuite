import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { generateInvoice } from '../services/invoices.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD format for dates.');

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1, 'clientId is required'),
  timeEntryIds: z.array(z.string().uuid()).min(1).optional(),
  invoiceDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  notes: z.string().max(4000).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional()
});

export const billingGenerateInvoiceTool = registerTool({
  name: 'billing_generate_invoice',
  description: 'Create a draft invoice from billable time entries and optional adjustments.',
  schema,
  execute: async (input) => {
    const result = await generateInvoice({
      userId: ensureUserId(input.userId),
      clientId: input.clientId,
      timeEntryIds: input.timeEntryIds,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      notes: input.notes,
      taxRate: input.taxRate,
      discountAmount: input.discountAmount
    });

    return {
      message: 'Invoice generated successfully.',
      invoice: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        clientId: result.clientId,
        subtotal: result.subtotal,
        tax: result.tax,
        discount: result.discount,
        total: result.total,
        dueDate: result.dueDate,
        status: result.status,
        timeEntriesIncluded: result.timeEntriesIncluded
      }
    };
  }
});
