import { randomUUID } from 'node:crypto';
import { Adapter, AdapterMessage, AdapterResult, AdapterStatus } from './adapter.js';
import { BridgeEvent, BridgeSession } from '../types.js';
import { RuntimeMode } from '../../config/runtime.js';
import { executeVPATool } from '../../orchestrator.js';
import { extractPrimaryContent, extractVoiceHint } from './event-factory.js';
import {
  createStreamEvent,
  createToolResultEvent,
  createToolStatusEvent
} from './adapter-events.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct';
const MAX_HISTORY_LENGTH = 40;
const MAX_PLAN_ATTEMPTS = 2;

type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_call_id?: string;
}

interface PlanDecision {
  decision: 'tool' | 'final';
  tool?: string;
  action?: string;
  parameters?: Record<string, any>;
  final_message?: string;
  reason?: string;
}

interface InvokeResult {
  message: ChatMessage;
  text: string;
}

export class OllamaAdapter implements Adapter {
  public readonly id: RuntimeMode = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly options: Record<string, any> | undefined;
  private healthy = false;
  private healthDetail = 'Waiting for first request';

  constructor() {
    this.baseUrl = DEFAULT_BASE_URL;
    this.model = DEFAULT_MODEL;
    this.options = parseOptions(process.env.OLLAMA_OPTIONS);

    if (!this.model) {
      this.healthDetail = 'Set OLLAMA_MODEL to enable local adapter';
    }
  }

  getStatus(): AdapterStatus {
    return {
      id: this.id,
      available: this.healthy,
      detail: this.healthy ? `Ollama model ${this.model}` : this.healthDetail
    };
  }

  async processMessage(
    session: BridgeSession,
    message: AdapterMessage,
    emit?: (event: BridgeEvent) => void
  ): Promise<AdapterResult> {
    const history = this.ensureHistory(session);
    history.push({ role: 'user', content: message.content });

    const plan = await this.planAction(history);

    if (plan.decision === 'final' || !plan.tool || !plan.action) {
      const finalMessage = plan.final_message ?? 'Let me know if you need anything else.';

      if (emit) {
        emit(createStreamEvent(finalMessage));
      }

      const finalEvent: BridgeEvent = {
        id: randomUUID(),
        type: 'message',
        message: {
          role: 'assistant',
          content: finalMessage
        }
      };

      history.push({ role: 'assistant', content: finalMessage });
      this.trimHistory(session, history);

      return { events: [finalEvent] };
    }

    if (emit) {
      emit(createToolStatusEvent(plan.tool, plan.action));
    }

    let toolResult: any;
    try {
      toolResult = await executeVPATool(plan.tool, plan.action, plan.parameters ?? {}, session.userId);
    } catch (error) {
      logger.error('Ollama adapter tool execution failed', {
        error,
        sessionId: session.id,
        tool: plan.tool,
        action: plan.action
      });

      toolResult = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Tool execution failed'
      };
    }

    if (emit) {
      emit(createToolResultEvent(plan.tool, plan.action, toolResult));
    }

    history.push({
      role: 'assistant',
      content: JSON.stringify({ tool_call: { tool: plan.tool, action: plan.action, parameters: plan.parameters ?? {} } })
    });
    history.push({
      role: 'tool',
      tool_call_id: randomUUID(),
      content: serializeToolResult(toolResult)
    });

    const summaryText = await this.generateSummary(history, toolResult, emit);

    const voiceHint = extractVoiceHint(toolResult);
    const fallback = extractPrimaryContent(toolResult);
    const assistantContent = summaryText || fallback;

    const finalEvent: BridgeEvent = {
      id: randomUUID(),
      type: 'message',
      message: {
        role: 'assistant',
        content: assistantContent,
        voiceHint
      },
      payload: {
        tool: plan.tool,
        action: plan.action,
        parameters: plan.parameters ?? {}
      }
    };

    history.push({ role: 'assistant', content: assistantContent });
    this.trimHistory(session, history);

    return {
      events: [finalEvent]
    };
  }

  private ensureHistory(session: BridgeSession): ChatMessage[] {
    if (!session.metadata) {
      session.metadata = {};
    }

    const metadata = session.metadata as Record<string, any> & { ollamaHistory?: ChatMessage[] };

    if (!Array.isArray(metadata.ollamaHistory)) {
      metadata.ollamaHistory = [createSystemMessage(BASE_SYSTEM_PROMPT)];
    }

    return metadata.ollamaHistory;
  }

  private trimHistory(session: BridgeSession, history: ChatMessage[]): void {
    if (!session.metadata) {
      return;
    }

    if (history.length <= MAX_HISTORY_LENGTH) {
      return;
    }

    const metadata = session.metadata as Record<string, any> & { ollamaHistory?: ChatMessage[] };
    metadata.ollamaHistory = history.slice(-MAX_HISTORY_LENGTH);
  }

  private async planAction(history: ChatMessage[]): Promise<PlanDecision> {
    let attempts = 0;
    let lastError: unknown;

    while (attempts < MAX_PLAN_ATTEMPTS) {
      attempts += 1;

  const messages: ChatMessage[] = [...history, createSystemMessage(PLANNER_PROMPT)];

      try {
        const { message } = await this.invokeOllama(messages, { stream: false });
        const plan = parsePlanDecision(message.content);

        if (plan) {
          this.healthy = true;
          this.healthDetail = `Ollama model ${this.model}`;
          return plan;
        }

        lastError = new Error('Invalid plan shape');
      } catch (error) {
        lastError = error;
        logger.warn('Ollama adapter planning attempt failed', {
          error,
          attempt: attempts
        });
      }
    }

    this.healthy = false;
    this.healthDetail = 'Failed to parse plan from Ollama response';

    throw lastError instanceof Error ? lastError : new Error('Ollama planning failed');
  }

  private async generateSummary(
    history: ChatMessage[],
    toolResult: any,
    emit?: (event: BridgeEvent) => void
  ): Promise<string> {
    const messages: ChatMessage[] = [
      ...history,
      createSystemMessage(SUMMARY_PROMPT),
      createSystemMessage(
        `Tool execution output:\n${serializeToolResult(toolResult)}\n\nWrite a concise spoken-ready update summarizing what happened and suggest a next step.`
      )
    ];

    try {
      const { text } = await this.invokeOllama(messages, {
        stream: true,
        emit
      });

      this.healthy = true;
      this.healthDetail = `Ollama model ${this.model}`;

      return text.trim();
    } catch (error) {
      logger.error('Ollama adapter summary generation failed', { error });
      this.healthy = false;
      this.healthDetail = 'Failed to generate summary';
      return '';
    }
  }

  private async invokeOllama(
    messages: ChatMessage[],
    options: { stream: boolean; emit?: (event: BridgeEvent) => void }
  ): Promise<InvokeResult> {
    const body = {
      model: this.model,
      stream: options.stream,
      messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
      options: this.options
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new Error(`Ollama request failed: ${response.status} ${detail}`);
    }

    if (!options.stream) {
  const payload = (await response.json()) as { message?: ChatMessage; response?: string };
  const message = payload?.message ?? { role: 'assistant', content: payload?.response ?? '' };
      return {
        message,
        text: message?.content ?? ''
      };
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let lastMessage: ChatMessage = { role: 'assistant', content: '' };

    if (!response.body) {
      return { message: lastMessage, text };
    }

    const reader = response.body.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const chunk = JSON.parse(line);
              const content = chunk?.message?.content ?? '';

              if (content) {
                text += content;
                lastMessage = chunk.message;

                if (options.emit) {
                  options.emit(createStreamEvent(content));
                }
              }
            } catch (error) {
              logger.warn('Ollama stream chunk parse failed', { error, line });
            }
          }

          newlineIndex = buffer.indexOf('\n');
        }
      }

      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim());
          const content = chunk?.message?.content ?? '';
          if (content) {
            text += content;
            lastMessage = chunk.message;
          }
        } catch (error) {
          logger.warn('Ollama trailing chunk parse failed', { error, chunk: buffer.trim() });
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      message: lastMessage,
      text
    };
  }
}

const BASE_SYSTEM_PROMPT = `You are VPA Core's local Ollama assistant. You help solopreneurs manage lead generation, pipeline updates, and email outreach.
Always operate in two steps:
1. Decide whether to call a tool or reply directly.
2. When instructed, summarize tool results for the user.
Keep reasoning internal; only output requested formats.`;

const TOOL_CATALOG = `Tools available:
- vpa_prospects: search, find_contacts, enrich, export, stats
- vpa_pipeline: add, update, search, log_activity, follow_ups, stats, import, update_follow_up
- vpa_email: create_campaign, add_sequence, start, send_one, stats, pause, history, create_and_start_sequence
- vpa_status: modules, usage, subscription, health, daily_brief
- vpa_configure: set
- vpa_modules: list`;

const PLANNER_PROMPT = `${TOOL_CATALOG}

Respond ONLY with JSON in this shape:
{
  "decision": "tool" | "final",
  "tool": "<tool id>",
  "action": "<action string>",
  "parameters": { ... },
  "final_message": "<string when decision=final>",
  "reason": "<brief rationale>"
}

Rules:
- When decision="tool", provide tool/action/parameters and omit final_message.
- When replying directly, set decision="final" and provide final_message.
- Do not include prose outside the JSON object.`;

const SUMMARY_PROMPT = `Provide a clear spoken-style summary for the user based on the latest tool result.
Keep it under 4 sentences and suggest a concrete next step when helpful.`;

function createSystemMessage(content: string): ChatMessage {
  return { role: 'system', content };
}

function parseOptions(raw: string | undefined): Record<string, any> | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    logger.warn('OLLAMA_OPTIONS failed to parse as JSON', { error, raw });
    return undefined;
  }
}

function parsePlanDecision(content: string): PlanDecision | null {
  try {
    const sanitized = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(sanitized);

    if (parsed?.decision === 'final') {
      return {
        decision: 'final',
        final_message: typeof parsed.final_message === 'string' ? parsed.final_message : undefined,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined
      } satisfies PlanDecision;
    }

    if (
      parsed?.decision === 'tool' &&
      typeof parsed.tool === 'string' &&
      typeof parsed.action === 'string'
    ) {
      const parameters = parsed.parameters && typeof parsed.parameters === 'object' ? parsed.parameters : {};

      return {
        decision: 'tool',
        tool: parsed.tool,
        action: parsed.action,
        parameters,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined
      } satisfies PlanDecision;
    }
  } catch (_error) {
    return null;
  }

  return null;
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

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (_error) {
    return '';
  }
}