import { z } from 'zod';
import { registerTool } from './tooling.js';
import { ensureUserId } from './helpers.js';
import { listRateCards } from '../services/rate-cards.js';

const schema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional()
});

export const billingGetRateCardsTool = registerTool({
  name: 'billing_get_rate_cards',
  description: 'List rate cards for a user, including default rates and client-specific overrides.',
  schema,
  execute: async (input) => {
    const result = await listRateCards({
      userId: ensureUserId(input.userId),
      clientId: input.clientId ?? null
    });

    return {
      defaultRate: result.defaultRate,
      rateCards: result.rateCards.map((card) => ({
        rateCardId: card.id,
        clientId: card.clientId,
        projectName: card.projectName,
        hourlyRate: card.hourlyRate,
        currency: card.currency,
        effectiveDate: card.effectiveDate,
        isDefault: card.isDefault
      }))
    };
  }
});
