import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { getProfitabilityReport } from '../services/reports.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD format for dates.');

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  projectName: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional()
});

export const billingGetProfitabilityReportTool = registerTool({
  name: 'billing_get_profitability_report',
  description: 'Summarize billed hours, revenue, and payment velocity to assess profitability trends.',
  schema,
  execute: async (input) => {
    const result = await getProfitabilityReport({
      userId: ensureUserId(input.userId),
      clientId: input.clientId,
      projectName: input.projectName,
      startDate: input.startDate,
      endDate: input.endDate
    });

    return {
      summary: result.summary,
      clients: result.clients.map((client) => ({
        clientId: client.clientId,
        clientName: client.clientName,
        totalHours: client.totalHours,
        totalBilled: client.totalBilled,
        totalPaid: client.totalPaid,
        avgHourlyRate: client.avgHourlyRate,
        paymentVelocity: client.paymentVelocity,
        profitMargin: client.profitMargin
      }))
    };
  }
});
