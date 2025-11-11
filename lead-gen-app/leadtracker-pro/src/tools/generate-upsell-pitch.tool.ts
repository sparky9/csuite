/**
 * generate_upsell_pitch MCP tool
 */

import { z } from 'zod';
import { generateUpsellPitch } from '../services/upsell.service.js';
import { logger } from '../utils/logger.js';

const GenerateUpsellPitchSchema = z.object({
  prospectId: z.string().uuid('Invalid prospectId'),
  upsellService: z.string().min(3, 'upsellService is required'),
  tone: z.enum(['casual', 'professional', 'executive']).default('professional'),
});

export async function generateUpsellPitchTool(args: unknown) {
  try {
    const input = GenerateUpsellPitchSchema.parse(args ?? {});

    logger.info('Tool: generate_upsell_pitch', input);

    const result = await generateUpsellPitch(input);

    const lines: string[] = [];
    lines.push(`✉️ **Upsell Pitch Draft for ${result.clientName}**`);
    lines.push(`Subject: ${result.subject}`);
    lines.push(`Tone: ${result.tone}`);
    lines.push('');
    lines.push('**Email Body**');
    lines.push('```');
    lines.push(result.emailBody);
    lines.push('```');

    if (result.talkingPoints.length) {
      lines.push('', '**Talking Points**');
      result.talkingPoints.forEach((point) => lines.push(`- ${point}`));
    }

    if (result.suggestedNextSteps.length) {
      lines.push('', '**Next Steps**');
      result.suggestedNextSteps.forEach((step) => lines.push(`- ${step}`));
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
    logger.error('generate_upsell_pitch failed', { error, args });

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
          text: `❌ Error generating upsell pitch: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
