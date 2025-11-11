/**
 * detect_upsell_opportunities MCP tool
 */

import { z } from 'zod';
import { detectUpsellOpportunities } from '../services/upsell.service.js';
import { logger } from '../utils/logger.js';

const DetectUpsellSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  prospectId: z.string().uuid('Invalid prospectId').optional(),
  minConfidence: z
    .number({ coerce: true })
    .min(0, 'minConfidence must be >= 0')
    .max(1, 'minConfidence must be <= 1')
    .optional(),
});

export async function detectUpsellOpportunitiesTool(args: unknown) {
  try {
    const input = DetectUpsellSchema.parse(args ?? {});

    const minConfidence = input.minConfidence ?? 0.7;

    logger.info('Tool: detect_upsell_opportunities', {
      userId: input.userId,
      prospectId: input.prospectId,
      minConfidence,
    });

    const result = await detectUpsellOpportunities({
      userId: input.userId,
      prospectId: input.prospectId,
      minConfidence,
    });

    if (!result.opportunities.length) {
      return {
        content: [
          {
            type: 'text',
            text: `🤝 No upsell opportunities met the ${Math.round(minConfidence * 100)}% confidence threshold.`,
          },
        ],
        data: result,
      };
    }

    const lines: string[] = [];
    lines.push(`🚀 **Upsell Opportunities (${result.opportunities.length})**`);
    lines.push(
      `Analyzed ${result.totalAnalyzed} prospect${result.totalAnalyzed === 1 ? '' : 's'} with a ${Math.round(
        minConfidence * 100
      )}% confidence floor.`
    );
    lines.push('');

    result.opportunities.slice(0, 10).forEach((opp, index) => {
      lines.push(
        `${index + 1}. **${opp.clientName}** → ${opp.suggestedUpsell} (${Math.round(opp.confidence * 100)}% confidence)`
      );
      lines.push(`   Reasoning: ${opp.reasoning}`);
      if (opp.estimatedValue) {
        lines.push(`   Estimated value: $${opp.estimatedValue.toLocaleString()}`);
      }
      if (opp.currentServices.length) {
        lines.push(`   Current services: ${opp.currentServices.join(', ')}`);
      }
      lines.push('');
    });

    if (result.opportunities.length > 10) {
      lines.push(`Showing top 10 of ${result.opportunities.length} opportunities.`);
    }

    return {
      content: [
        {
          type: 'text',
          text: lines.join('\n'),
        },
      ],
      data: result,
    };
  } catch (error) {
    logger.error('detect_upsell_opportunities failed', { error, args });

    if (error instanceof z.ZodError) {
      const details = error.errors.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join(', ');
      return {
        content: [{ type: 'text', text: `❌ Validation error: ${details}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error detecting upsell opportunities: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
