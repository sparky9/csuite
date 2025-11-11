import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { listTimeEntries } from '../services/time-entries.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD format for dates.');

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  projectName: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  billable: z.boolean().optional(),
  invoiced: z.boolean().optional(),
  limit: z.number().int().positive().max(200).optional()
});

export const timeGetEntriesTool = registerTool({
  name: 'time_get_entries',
  description: 'Retrieve recent time entries along with billing totals and unbilled amounts.',
  schema,
  execute: async (input) => {
    const result = await listTimeEntries({
      userId: ensureUserId(input.userId),
      clientId: input.clientId,
      projectName: input.projectName,
      startDate: input.startDate,
      endDate: input.endDate,
      billable: input.billable,
      invoiced: input.invoiced,
      limit: input.limit
    });

    return {
      summary: {
        totalHours: result.totalHours,
        totalAmount: result.totalAmount,
        unbilledAmount: result.unbilledAmount,
        entryCount: result.entries.length
      },
      entries: result.entries.map((entry) => ({
        entryId: entry.id,
        clientId: entry.clientId,
        projectName: entry.projectName,
        task: entry.taskDescription,
        date: entry.date,
        durationMinutes: entry.durationMinutes,
        amount: entry.amount,
        billable: entry.billable,
        invoiced: entry.invoiced,
        invoiceId: entry.invoiceId
      }))
    };
  }
});
