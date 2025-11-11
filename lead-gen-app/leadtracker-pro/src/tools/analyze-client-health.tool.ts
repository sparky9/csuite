/**
 * analyze_client_health MCP tool
 */

import { z } from 'zod';
import { analyzeClientHealth } from '../services/client-health.service.js';
import { logger } from '../utils/logger.js';

const AnalyzeClientHealthSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  prospectId: z.string().uuid('Invalid prospectId'),
});

const HEALTH_EMOJI: Record<string, string> = {
  excellent: '💚',
  healthy: '🟢',
  warning: '🟠',
  'at-risk': '🟥',
  critical: '🚨',
};

export async function analyzeClientHealthTool(args: unknown) {
  try {
    const input = AnalyzeClientHealthSchema.parse(args);

    logger.info('Tool: analyze_client_health', input);

    const result = await analyzeClientHealth(input);

    const emoji = HEALTH_EMOJI[result.healthLevel] ?? '📊';

    const textLines: string[] = [
      `${emoji} **Client Health: ${result.prospectName}**`,
      `Score: **${result.healthScore}/100** (${result.healthLevel})`,
      '',
      '**Signals**',
    ];

    textLines.push(
      `- Days since interaction: ${
        result.signals.lastInteractionDays === null ? 'not tracked' : `${result.signals.lastInteractionDays} day(s)`
      }`
    );
    textLines.push(`- Payment status: ${result.signals.paymentStatus}`);
    textLines.push(`- Active projects: ${result.signals.projectCount}`);
    textLines.push(
      `- Avg response: ${
        result.signals.avgResponseTimeHours === null
          ? 'unknown'
          : `${result.signals.avgResponseTimeHours} hour(s)`
      }`
    );
    textLines.push(`- Sentiment trend: ${result.signals.sentimentTrend}`);

    if (result.riskFactors.length) {
      textLines.push('', '**Risk Factors**');
      result.riskFactors.forEach((factor) => textLines.push(`- ${factor}`));
    }

    if (result.recommendations.length) {
      textLines.push('', '**Recommended Actions**');
      result.recommendations.forEach((rec) => textLines.push(`- ${rec}`));
    }

    return {
      content: [
        {
          type: 'text',
          text: textLines.join('\n'),
        },
      ],
      data: result,
    };
  } catch (error) {
    logger.error('analyze_client_health failed', { error, args });

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
          text: `❌ Error analyzing client health: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
