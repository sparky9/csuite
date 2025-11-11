import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { createTimeEntry } from '../services/time-entries.js';

const isoDateTime = z.string().datetime({ message: 'Must be an ISO 8601 date-time string.' });

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1, 'clientId is required'),
  projectName: z.string().min(1, 'projectName is required'),
  taskDescription: z.string().min(1, 'taskDescription is required'),
  durationMinutes: z.number().int().positive('durationMinutes must be a positive integer'),
  startTime: isoDateTime.optional(),
  endTime: isoDateTime.optional(),
  billable: z.boolean().optional(),
  notes: z.string().max(2000, 'notes must be 2000 characters or fewer').optional()
});

export const timeTrackEntryTool = registerTool({
  name: 'time_track_entry',
  description: 'Log time for a project, automatically calculating billable amounts using rate cards.',
  schema,
  execute: async (input) => {
    const result = await createTimeEntry({
      userId: ensureUserId(input.userId),
      clientId: input.clientId,
      projectName: input.projectName,
      taskDescription: input.taskDescription,
      durationMinutes: input.durationMinutes,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      billable: input.billable,
      notes: input.notes
    });

    return {
      message: 'Time entry recorded successfully.',
      entry: {
        entryId: result.entryId,
        durationMinutes: result.duration,
        billable: result.billable,
        calculatedAmount: result.calculatedAmount,
        hourlyRate: result.hourlyRate,
        currency: result.currency,
        rateSource: result.rateSource
      }
    };
  }
});
