/**
 * Autonomous support agent harnessing local RAG for ticket resolution.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { queryRag } from '../rag/query.js';
import { logger } from '../utils/logger.js';
import type { RagQueryResult } from '../rag/types.js';
import { recordSupportAgentEvent } from './support-agent-telemetry.js';

dotenv.config();

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  logger.warn('ANTHROPIC_API_KEY not set. Support agent will fail when invoked.');
}

const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

export type SupportChannel = 'email' | 'chat' | 'phone' | 'webform';

export interface SupportTicket {
  id: string;
  subject: string;
  body: string;
  customerName?: string;
  channel?: SupportChannel;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export type SupportAgentOutcome = 'respond' | 'ask_customer' | 'escalate';

export interface SupportAgentResult {
  ticketId: string;
  outcome: SupportAgentOutcome;
  summary: string;
  reply?: string;
  followUpQuestions?: string[];
  escalationReason?: string;
  citations: SupportAgentCitation[];
  rawModelOutput?: string;
}

export interface SupportAgentCitation {
  sourceId: string;
  documentSource: string;
  score: number;
  location?: string;
}

export interface SupportAgentOptions {
  topK?: number;
  minScore?: number;
  autoEscalateScore?: number;
  maxSnippetLength?: number;
  temperature?: number;
  mockMode?: boolean;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    SupportAgentOptions,
    'topK' | 'minScore' | 'autoEscalateScore' | 'maxSnippetLength' | 'temperature'
  >
> = {
  topK: 6,
  minScore: 0.2,
  autoEscalateScore: 0.28,
  maxSnippetLength: 850,
  temperature: 0.2,
};

function truncateSnippet(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function buildKnowledgeContext(
  snippets: RagQueryResult[],
  maxLength: number,
): { formatted: string; citations: SupportAgentCitation[] } {
  const blocks: string[] = [];
  const citations: SupportAgentCitation[] = [];

  snippets.forEach((snippet, index) => {
    const sourceId = `Source ${index + 1}`;
    const location =
      (snippet.metadata?.file_path as string | undefined) ||
      (snippet.documentMetadata?.file_path as string | undefined) ||
      undefined;

    blocks.push(
      `${sourceId}\nDocument: ${snippet.documentSource}\nScore: ${(snippet.score * 100).toFixed(1)}%\nLocation: ${location || 'n/a'}\nExcerpt: ${truncateSnippet(snippet.content, maxLength)}`,
    );

    citations.push({
      sourceId,
      documentSource: snippet.documentSource,
      score: snippet.score,
      location,
    });
  });

  return {
    formatted: blocks.join('\n\n'),
    citations,
  };
}

function buildTicketSummary(ticket: SupportTicket): string {
  const lines: string[] = [];
  lines.push(`Ticket ID: ${ticket.id}`);
  lines.push(`Subject: ${ticket.subject}`);
  if (ticket.customerName) {
    lines.push(`Customer: ${ticket.customerName}`);
  }
  if (ticket.channel) {
    lines.push(`Channel: ${ticket.channel}`);
  }
  if (ticket.priority) {
    lines.push(`Priority: ${ticket.priority}`);
  }
  lines.push('\nCustomer Message:');
  lines.push(ticket.body.trim());
  return lines.join('\n');
}

function buildLLMPrompt(ticket: SupportTicket, knowledge: string): string {
  return `You are the autonomous frontline support agent for Forge. Resolve tickets end-to-end unless policy requires human escalation.

<<Ticket>>
${buildTicketSummary(ticket)}

<<Knowledge Base Extracts>>
${knowledge || 'No matching knowledge available.'}

Responsibilities:
1. Interpret the ticket and provide a grounded answer using the knowledge extracts.
2. If knowledge is missing or confidence is low, draft clarifying questions for the customer.
3. Escalate to a human only for policy, safety, billing disputes, or when knowledge is insufficient.
4. Always cite sources by referencing [Source #] tags in-line and in a final citations list.

Produce a JSON object with the following structure:
{
  "outcome": "respond" | "ask_customer" | "escalate",
  "summary": "concise description of the action taken",
  "reply": "draft message to send to the customer (include greetings and sign-off)",
  "follow_up_questions": ["question", ...],
  "escalation_reason": "why a human is needed (only if outcome is escalate)",
  "citations": [
    { "source_id": "Source 1", "justification": "short note on how the source supports the reply" }
  ]
}
- reply is required when outcome is "respond"
- follow_up_questions is required when outcome is "ask_customer"
- citations must only reference the provided sources
- Never fabricate information.
`;
}

function safeParseModelJson(payload: string): any | null {
  try {
    const firstCurly = payload.indexOf('{');
    const lastCurly = payload.lastIndexOf('}');
    if (firstCurly === -1 || lastCurly === -1 || lastCurly <= firstCurly) {
      return null;
    }
    const jsonSegment = payload.slice(firstCurly, lastCurly + 1);
    return JSON.parse(jsonSegment);
  } catch (error) {
    logger.error('Failed to parse support agent model JSON', { error });
    return null;
  }
}

export async function handleSupportTicket(
  ticket: SupportTicket,
  options: SupportAgentOptions = {},
): Promise<SupportAgentResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const mockMode = options.mockMode ?? process.env.MOCK_SUPPORT_AGENT === '1';

  const question = `${ticket.subject}\n\n${ticket.body}`;
  const ragResponse = await queryRag(question, {
    topK: mergedOptions.topK,
    minScore: mergedOptions.minScore,
  });

  const topScore = ragResponse.results[0]?.score ?? 0;
  const totalResults = ragResponse.results.length;

  const shouldAutoEscalate =
    !mockMode && (!ragResponse.results.length || topScore < mergedOptions.autoEscalateScore);

  if (shouldAutoEscalate) {
    logger.info('Support agent auto-escalating due to low RAG confidence', {
      ticketId: ticket.id,
      topScore,
    });

    const result: SupportAgentResult = {
      ticketId: ticket.id,
      outcome: 'escalate',
      summary: 'Escalated automatically due to insufficient knowledge coverage.',
      escalationReason: 'Knowledge base returned no high-confidence matches. Needs human review.',
      citations: [],
    };

    await recordSupportAgentEvent({
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      outcome: result.outcome,
      summary: result.summary,
      topScore,
      totalResults,
      autoEscalated: true,
      escalationReason: result.escalationReason,
    });

    return result;
  }

  const { formatted, citations } = buildKnowledgeContext(
    ragResponse.results,
    mergedOptions.maxSnippetLength,
  );

  if (mockMode) {
    if (!ragResponse.results.length) {
      const result: SupportAgentResult = {
        ticketId: ticket.id,
        outcome: 'escalate',
        summary: 'Escalated in mock mode because no knowledge snippets were found.',
        escalationReason: 'Knowledge base returned zero matches.',
        citations: [],
        rawModelOutput: 'MOCK_SUPPORT_AGENT_NO_DATA',
      };

      await recordSupportAgentEvent({
        timestamp: new Date().toISOString(),
        ticketId: ticket.id,
        outcome: result.outcome,
        summary: result.summary,
        topScore,
        totalResults,
        autoEscalated: true,
        escalationReason: result.escalationReason,
      });

      return result;
    }

    const topSnippet = ragResponse.results[0];
    const replyLines: string[] = [];
    replyLines.push(`Hello ${ticket.customerName ?? 'there'},`);
    replyLines.push('');
    replyLines.push(
      'Thanks for reaching out. Based on our internal guidance, here\'s what you need to know:',
    );
    replyLines.push('');
    replyLines.push(truncateSnippet(topSnippet.content, mergedOptions.maxSnippetLength));
    replyLines.push('');
    replyLines.push('If anything remains unclear, let us know and we will be happy to help.');
    replyLines.push('');
    replyLines.push('Best regards,');
    replyLines.push('Forge Support');

    const result: SupportAgentResult = {
      ticketId: ticket.id,
      outcome: 'respond',
      summary: 'Drafted mock response using RAG snippet (mock mode enabled).',
      reply: replyLines.join('\n'),
      citations,
      rawModelOutput: 'MOCK_SUPPORT_AGENT',
    };

    await recordSupportAgentEvent({
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      outcome: result.outcome,
      summary: result.summary,
      topScore,
      totalResults,
      autoEscalated: false,
    });

    return result;
  }

  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  const prompt = buildLLMPrompt(ticket, formatted);

  const response = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 1800,
    temperature: mergedOptions.temperature,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  let combinedText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      combinedText += block.text;
    }
  }

  const parsed = safeParseModelJson(combinedText);

  if (!parsed) {
    logger.warn('Support agent failed to parse model output, escalating ticket.', {
      ticketId: ticket.id,
      combinedText,
    });
    const result: SupportAgentResult = {
      ticketId: ticket.id,
      outcome: 'escalate',
      summary: 'Escalated because AI response could not be parsed.',
      escalationReason: 'Model output was not valid JSON.',
      citations,
      rawModelOutput: combinedText,
    };

    await recordSupportAgentEvent({
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      outcome: result.outcome,
      summary: result.summary,
      topScore,
      totalResults,
      autoEscalated: false,
      escalationReason: result.escalationReason,
    });

    return result;
  }

  const outcome = parsed.outcome as SupportAgentOutcome;

  if (outcome === 'respond' && typeof parsed.reply !== 'string') {
    logger.warn('Support agent response missing reply text, escalating ticket.', {
      ticketId: ticket.id,
    });
    const result: SupportAgentResult = {
      ticketId: ticket.id,
      outcome: 'escalate',
      summary: 'Escalated because reply text was missing.',
      escalationReason: 'Model did not return a reply.',
      citations,
      rawModelOutput: combinedText,
    };

    await recordSupportAgentEvent({
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      outcome: result.outcome,
      summary: result.summary,
      topScore,
      totalResults,
      autoEscalated: false,
      escalationReason: result.escalationReason,
    });

    return result;
  }

  if (outcome === 'ask_customer' && !Array.isArray(parsed.follow_up_questions)) {
    logger.warn('Support agent response missing follow up questions, escalating ticket.', {
      ticketId: ticket.id,
    });
    const result: SupportAgentResult = {
      ticketId: ticket.id,
      outcome: 'escalate',
      summary: 'Escalated because follow up questions were missing.',
      escalationReason: 'Model did not return follow up questions.',
      citations,
      rawModelOutput: combinedText,
    };

    await recordSupportAgentEvent({
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      outcome: result.outcome,
      summary: result.summary,
      topScore,
      totalResults,
      autoEscalated: false,
      escalationReason: result.escalationReason,
    });

    return result;
  }

  if (outcome === 'escalate' && typeof parsed.escalation_reason !== 'string') {
    parsed.escalation_reason = 'Escalation requested but no reason provided by model.';
  }

  const normalizedCitations: SupportAgentCitation[] = Array.isArray(parsed.citations)
    ? parsed.citations
        .filter((entry: any) => typeof entry?.source_id === 'string')
        .map((entry: any) => {
          const match = citations.find((c) => c.sourceId === entry.source_id);
          return {
            sourceId: entry.source_id,
            documentSource: match?.documentSource || 'unknown',
            score: match?.score ?? 0,
            location: match?.location,
          };
        })
    : citations;

  const result: SupportAgentResult = {
    ticketId: ticket.id,
    outcome,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary provided.',
    reply: typeof parsed.reply === 'string' ? parsed.reply : undefined,
    followUpQuestions: Array.isArray(parsed.follow_up_questions)
      ? parsed.follow_up_questions.filter((item: unknown) => typeof item === 'string')
      : undefined,
    escalationReason:
      typeof parsed.escalation_reason === 'string' ? parsed.escalation_reason : undefined,
    citations: normalizedCitations,
    rawModelOutput: combinedText,
  };

  await recordSupportAgentEvent({
    timestamp: new Date().toISOString(),
    ticketId: ticket.id,
    outcome: result.outcome,
    summary: result.summary,
    topScore,
    totalResults,
    autoEscalated: false,
    escalationReason: result.escalationReason,
  });

  logger.info('Support agent completed ticket', {
    ticketId: ticket.id,
    outcome: result.outcome,
    topScore,
    totalResults,
    mockMode,
  });

  return result;
}
