import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { Adapter, AdapterMessage, AdapterResult, AdapterStatus } from './adapter.js';
import { BridgeEvent, BridgeSession } from '../types.js';
import { RuntimeMode } from '../../config/runtime.js';
import { logger } from '../../utils/logger.js';
import { executeVPATool } from '../../orchestrator.js';
import { extractPrimaryContent, extractVoiceHint } from './event-factory.js';
import { createStreamEvent, createToolResultEvent, createToolStatusEvent } from './adapter-events.js';

const DEFAULT_MODEL = process.env.CLAUDE_API_MODEL || 'claude-3-5-sonnet-20241022';
const MAX_HISTORY_LENGTH = 30;

interface ClaudeMessageParam {
  role: 'user' | 'assistant';
  content: ClaudeContentBlock[];
}

interface ClaudeContentBlockText {
  type: 'text';
  text: string;
}

interface ClaudeContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

interface ClaudeContentBlockToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ClaudeContentBlockText[];
}

type ClaudeContentBlock = ClaudeContentBlockText | ClaudeContentBlockToolUse | ClaudeContentBlockToolResult;

interface ToolInvocation {
  id: string;
  name: string;
  input: Record<string, any>;
}

interface RoutedIntent {
  tool: string;
  action: string;
  parameters: Record<string, any>;
  confidence: number;
}

interface ClaudeStepResult {
  message: Anthropic.Messages.Message;
  streamedText: string;
  stopReason: string | null;
  tools: ToolInvocation[];
}

const CLAUDE_SYSTEM_PROMPT = `You are the VPA Core cloud assistant. You help solopreneurs manage leads, pipeline updates, outreach campaigns, and status reports.

You have direct access to structured tools that execute business actions. When the user asks for work, pick the correct tool, provide a succinct action summary in the tool input, and include any required parameters. If you need more information, ask clarifying questions.

After tools return results, summarize the outcome for the user with clear next steps.`;

const CLAUDE_TOOLS = [
  {
    name: 'vpa_prospects',
    description: 'Prospect finder: search companies, find contacts, enrich data, export lists, view stats.',
    input_schema: buildToolSchema(['search', 'find_contacts', 'enrich', 'export', 'stats'])
  },
  {
    name: 'vpa_pipeline',
    description: 'Pipeline manager: add/update prospects, log activity, manage follow-ups, run stats, import lists.',
    input_schema: buildToolSchema(['add', 'update', 'search', 'log_activity', 'follow_ups', 'stats', 'import', 'update_follow_up'])
  },
  {
    name: 'vpa_email',
    description: 'Email orchestrator: create campaigns, manage sequences, start/pause sends, stats, history.',
    input_schema: buildToolSchema(['create_campaign', 'add_sequence', 'start', 'send_one', 'stats', 'pause', 'history', 'create_and_start_sequence'])
  },
  {
    name: 'vpa_status',
    description: 'Status dashboard: modules, usage, subscription, system health, daily brief.',
    input_schema: buildToolSchema(['modules', 'usage', 'subscription', 'health', 'daily_brief'])
  },
  {
    name: 'vpa_configure',
    description: 'Runtime configuration updates (e.g. set defaults).',
    input_schema: buildToolSchema(['set'])
  },
  {
    name: 'vpa_modules',
    description: 'Discover available VPA modules and capabilities.',
    input_schema: buildToolSchema(['list'])
  }
];

function buildToolSchema(actions: string[]) {
  return {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: actions
      },
      parameters: {
        type: 'object',
        description: 'JSON payload matching the VPA tool signature.',
        additionalProperties: true
      }
    },
    required: ['action'],
    additionalProperties: false
  } as any;
}

export class ClaudeApiAdapter implements Adapter {
  public readonly id: RuntimeMode = 'claude-api';
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  getStatus(): AdapterStatus {
    if (!this.client) {
      return {
        id: this.id,
        available: false,
        detail: 'Missing ANTHROPIC_API_KEY environment variable'
      };
    }

    return {
      id: this.id,
      available: true,
      detail: `Anthropic model ${DEFAULT_MODEL}`
    };
  }

  async processMessage(
    session: BridgeSession,
    message: AdapterMessage,
    emit?: (event: BridgeEvent) => void
  ): Promise<AdapterResult> {
    if (!this.client) {
      throw new Error('Claude API adapter unavailable – ANTHROPIC_API_KEY missing');
    }

    const history = this.ensureHistory(session);
    history.push(createUserMessage(message.content));

    let lastIntent: RoutedIntent | null = null;
    let lastToolResult: any = null;
    let finalText = '';

    while (true) {
      const step = await this.invokeClaude(history, emit);
      history.push(step.message);

      if (step.stopReason === 'tool_use' && step.tools.length) {
        for (const toolCall of step.tools) {
          const intent = this.parseToolInvocation(toolCall);
          lastIntent = intent;

          if (emit) {
            emit(createToolStatusEvent(intent.tool, intent.action));
          }

          let toolResult: any;
          try {
            toolResult = await executeVPATool(intent.tool, intent.action, intent.parameters, session.userId);
          } catch (error) {
            logger.error('Claude API adapter tool execution failed', {
              sessionId: session.id,
              tool: intent.tool,
              action: intent.action,
              error
            });

            toolResult = {
              status: 'error',
              message: error instanceof Error ? error.message : 'Tool execution failed'
            };
          }

          lastToolResult = toolResult;

          if (emit) {
            emit(createToolResultEvent(intent.tool, intent.action, toolResult));
          }

          history.push(createToolResultMessage(toolCall.id, toolResult));
        }

        continue;
      }

      finalText = step.streamedText.trim() || extractAssistantText(step.message);
      break;
    }

    this.trimHistory(session, history);

    const payload = lastIntent
      ? {
          tool: lastIntent.tool,
          action: lastIntent.action,
          parameters: lastIntent.parameters
        }
      : undefined;

    const voiceHint = lastToolResult ? extractVoiceHint(lastToolResult) : undefined;
    const fallback = lastToolResult ? extractPrimaryContent(lastToolResult) : 'Action completed.';
    const assistantContent = finalText || fallback;

    const finalEvent: BridgeEvent = {
      id: randomUUID(),
      type: 'message',
      message: {
        role: 'assistant',
        content: assistantContent,
        voiceHint
      },
      payload
    };

    return {
      events: [finalEvent]
    };
  }

  private async invokeClaude(
    history: ClaudeMessageParam[],
    emit?: (event: BridgeEvent) => void
  ): Promise<ClaudeStepResult> {
    if (!this.client) {
      throw new Error('Claude API adapter unavailable – client not initialized');
    }

    const stream = await this.client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: history,
      tools: CLAUDE_TOOLS
    });

    let textBuffer = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const delta = event.delta.text ?? '';
        textBuffer += delta;

        if (delta && emit) {
          emit(createStreamEvent(delta));
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    const stopReason = finalMessage.stop_reason ?? null;
    const toolCalls = extractToolCalls(finalMessage.content ?? []);

    return {
      message: finalMessage,
      streamedText: textBuffer,
      stopReason,
      tools: toolCalls
    };
  }

  private parseToolInvocation(tool: ToolInvocation): RoutedIntent {
    const action = typeof tool.input?.action === 'string' ? tool.input.action : 'modules';
    const parameters = tool.input?.parameters && typeof tool.input.parameters === 'object'
      ? tool.input.parameters
      : {};

    return {
      tool: tool.name,
      action,
      parameters,
      confidence: 0.95
    } satisfies RoutedIntent;
  }

  private ensureHistory(session: BridgeSession): ClaudeMessageParam[] {
    if (!session.metadata) {
      session.metadata = {};
    }

    const metadata = session.metadata as Record<string, any> & { claudeHistory?: ClaudeMessageParam[] };

    if (!Array.isArray(metadata.claudeHistory)) {
      metadata.claudeHistory = [];
    }

    return metadata.claudeHistory;
  }

  private trimHistory(session: BridgeSession, history: ClaudeMessageParam[]): void {
    if (!session.metadata) {
      return;
    }

    if (history.length <= MAX_HISTORY_LENGTH) {
      return;
    }

    const metadata = session.metadata as Record<string, any> & { claudeHistory?: ClaudeMessageParam[] };
    metadata.claudeHistory = history.slice(-MAX_HISTORY_LENGTH);
  }
}

function createUserMessage(content: string): ClaudeMessageParam {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: content
      }
    ]
  } satisfies ClaudeMessageParam;
}

function extractToolCalls(blocks: ClaudeContentBlock[]): ToolInvocation[] {
  return blocks
    .filter((block): block is ClaudeContentBlockToolUse => block.type === 'tool_use')
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input || {}
    }));
}

function extractAssistantText(message: Anthropic.Messages.Message): string {
  const blocks = message.content ?? [];
  const parts = blocks
    .filter((block): block is ClaudeContentBlockText => block.type === 'text')
    .map((block) => block.text.trim())
    .filter(Boolean);

  return parts.join('\n').trim();
}

function createToolResultMessage(toolUseId: string, toolResult: any): ClaudeMessageParam {
  const serialized = serializeToolResult(toolResult);

  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: serialized
      }
    ]
  } satisfies ClaudeMessageParam;
}

function serializeToolResult(result: any): string {
  if (typeof result === 'string') {
    return result;
  }

  try {
    return JSON.stringify(result);
  } catch (_error) {
    return JSON.stringify({ status: 'error', message: 'Unable to serialize tool result' });
  }
}

