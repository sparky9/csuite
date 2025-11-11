import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { setRateCard } from '../services/rate-cards.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD format for effectiveDate.');

const currencyCode = z
  .string()
  .length(3, 'Currency codes must be 3 characters.')
  .regex(/^[A-Za-z]{3}$/u, 'Currency codes must contain letters only.')
  .transform((value: string) => value.toUpperCase());

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  projectName: z.string().min(1).optional(),
  hourlyRate: z.number().positive('hourlyRate must be greater than zero.'),
  currency: currencyCode.optional(),
  effectiveDate: isoDate.optional()
});

export const billingSetRateCardTool = registerTool({
  name: 'billing_set_rate_card',
  description: 'Create or update a rate card for a client or project, including default rates.',
  schema,
  execute: async (input) => {
    const result = await setRateCard({
      userId: ensureUserId(input.userId),
      clientId: input.clientId ?? null,
      projectName: input.projectName ?? null,
      hourlyRate: input.hourlyRate,
      currency: input.currency,
      effectiveDate: input.effectiveDate
    });

    return {
      message: 'Rate card saved successfully.',
      rateCard: {
        rateCardId: result.id,
        clientId: result.clientId,
        projectName: result.projectName,
        hourlyRate: result.hourlyRate,
        currency: result.currency,
        effectiveDate: result.effectiveDate,
        isDefault: result.isDefault
      }
    };
  }
});
