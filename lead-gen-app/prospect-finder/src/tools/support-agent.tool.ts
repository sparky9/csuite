/**
 * MCP tool entry point for the autonomous support agent.
 */

import { z } from 'zod';
import { handleSupportTicket } from 'support-agent';
import { logger } from '../utils/logger.js';

const SupportAgentSchema = z.object({
  ticket_id: z.string().min(1),
  subject: z.string().min(3),
  body: z.string().min(5),
  customer_name: z.string().optional(),
  channel: z.enum(['email', 'chat', 'phone', 'webform']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  metadata: z.record(z.unknown()).optional(),
  top_k: z.number().int().min(1).max(12).optional(),
  min_score: z.number().min(-1).max(1).optional(),
  auto_escalate_score: z.number().min(-1).max(1).optional(),
});

export async function supportAgentTool(args: unknown) {
  const params = SupportAgentSchema.parse(args ?? {});

  logger.info('support_agent tool invoked', { ticketId: params.ticket_id });

  const result = await handleSupportTicket(
    {
      id: params.ticket_id,
      subject: params.subject,
      body: params.body,
      customerName: params.customer_name,
      channel: params.channel,
      priority: params.priority,
      metadata: params.metadata,
    },
    {
      topK: params.top_k,
      minScore: params.min_score,
      autoEscalateScore: params.auto_escalate_score,
    }
  );

  const lines: string[] = [];
  lines.push('Support Agent Result');
  lines.push(`Ticket: ${result.ticketId}`);
  lines.push(`Outcome: ${result.outcome}`);
  lines.push(`Summary: ${result.summary}`);

  if (result.reply) {
    lines.push('\nReply Draft:\n');
    lines.push(result.reply);
  }

  if (result.followUpQuestions?.length) {
    lines.push('\nFollow-up Questions:');
    for (const question of result.followUpQuestions) {
      lines.push(`- ${question}`);
    }
  }

  if (result.escalationReason) {
    lines.push(`\nEscalation Reason: ${result.escalationReason}`);
  }

  if (result.citations.length) {
    lines.push('\nCitations:');
    for (const citation of result.citations) {
      lines.push(`- ${citation.sourceId}: ${citation.documentSource} (score ${(citation.score * 100).toFixed(1)}%)`);
      if (citation.location) {
        lines.push(`  location: ${citation.location}`);
      }
    }
  }

  lines.push('\nRaw JSON:');
  lines.push('```json');
  lines.push(JSON.stringify(result, null, 2));
  lines.push('```');

  return {
    content: [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ],
  };
}
