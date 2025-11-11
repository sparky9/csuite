import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import {
	Adapter,
	AdapterMessage,
	AdapterResult,
	AdapterStatus
} from './adapter.js';
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

const DEFAULT_MODEL = process.env.OPENAI_ROUTER_MODEL || 'gpt-4o-mini';
const MAX_HISTORY_LENGTH = 30;

type ChatMessageParam = any;
type ChatTool = any;
type ChatChunk = any;

interface AccumulatedToolCall {
	id: string;
	name: string;
	arguments: string;
}

const SYSTEM_PROMPT = `You are the VPA Core assistant. Use the structured tools to execute business tasks (prospecting, pipeline updates, email campaigns, status summaries). Ask for clarification when inputs are ambiguous. After tools respond, summarize the outcomes and suggest next steps.`;

const OPENAI_TOOLS: ChatTool[] = [
	buildFunctionTool('vpa_prospects', 'Prospect finder', [
		'search',
		'find_contacts',
		'enrich',
		'export',
		'stats'
	]),
	buildFunctionTool('vpa_pipeline', 'Pipeline manager', [
		'add',
		'update',
		'search',
		'log_activity',
		'follow_ups',
		'stats',
		'import',
		'update_follow_up'
	]),
	buildFunctionTool('vpa_email', 'Email orchestrator', [
		'create_campaign',
		'add_sequence',
		'start',
		'send_one',
		'stats',
		'pause',
		'history',
		'create_and_start_sequence'
	]),
	buildFunctionTool('vpa_status', 'Status dashboard', [
		'modules',
		'usage',
		'subscription',
		'health',
		'daily_brief'
	]),
	buildFunctionTool('vpa_configure', 'Runtime configuration updates', ['set']),
	buildFunctionTool('vpa_modules', 'Module discovery', ['list'])
];

function buildFunctionTool(name: string, description: string, actions: string[]): ChatTool {
	return {
		type: 'function',
		function: {
			name,
			description,
			parameters: {
				type: 'object',
				properties: {
					action: {
						type: 'string',
						enum: actions
					},
					parameters: {
						type: 'object',
						additionalProperties: true
					}
				},
				required: ['action'],
				additionalProperties: false
			}
		}
	} as ChatTool;
}

export class OpenAIAdapter implements Adapter {
	public readonly id: RuntimeMode = 'openai';
	private readonly apiKey: string | undefined;
			private clientPromise: Promise<any | null> | null = null;

	constructor() {
		this.apiKey = process.env.OPENAI_API_KEY;
	}

	getStatus(): AdapterStatus {
		if (!this.apiKey) {
			return {
				id: this.id,
				available: false,
				detail: 'Missing OPENAI_API_KEY environment variable'
			};
		}

		return {
			id: this.id,
			available: true,
			detail: `OpenAI model ${DEFAULT_MODEL}`
		};
	}

	async processMessage(
		session: BridgeSession,
		message: AdapterMessage,
		emit?: (event: BridgeEvent) => void
	): Promise<AdapterResult> {
		const client = await this.getClient();
		if (!client) {
			throw new Error('OpenAI adapter unavailable – OPENAI_API_KEY missing');
		}

		const history = this.ensureHistory(session);
		history.push({ role: 'user', content: message.content });

		let lastToolResult: any = null;
		let lastInvocation: { tool: string; action: string; parameters: Record<string, any> } | null = null;
		let finalText = '';

		while (true) {
			const { response, accumulatedText, toolCalls } = await this.invokeOpenAI(
				client,
				history,
				emit
			);

			if (toolCalls.length > 0) {
				history.push(response);

				for (const toolCall of toolCalls) {
								const action = parseAction(toolCall.arguments);
								const parameters = parseParameters(toolCall.arguments);

								lastInvocation = {
									tool: toolCall.name,
									action,
									parameters
								};

					if (emit) {
						emit(createToolStatusEvent(toolCall.name, action));
					}

					let toolResult: any;
					try {
						toolResult = await executeVPATool(toolCall.name, action, parameters, session.userId);
					} catch (error) {
						logger.error('OpenAI adapter tool execution failed', {
							sessionId: session.id,
							tool: toolCall.name,
							action,
							error
						});

						toolResult = {
							status: 'error',
							message: error instanceof Error ? error.message : 'Tool execution failed'
						};
					}

					lastToolResult = toolResult;

					if (emit) {
						emit(createToolResultEvent(toolCall.name, action, toolResult));
					}

					history.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: serializeToolResult(toolResult)
					});
				}

				continue;
			}

			finalText = accumulatedText.trim() || extractAssistantContent(response);
			history.push(response);
			break;
		}

		this.trimHistory(session, history);

		const voiceHint = lastToolResult ? extractVoiceHint(lastToolResult) : undefined;
		const fallback = lastToolResult ? extractPrimaryContent(lastToolResult) : 'Action complete.';
		const assistantContent = finalText || fallback;

			const finalEvent: BridgeEvent = {
			id: randomUUID(),
			type: 'message',
			message: {
				role: 'assistant',
				content: assistantContent,
				voiceHint
				},
				payload: lastInvocation ?? undefined
		};

		return {
			events: [finalEvent]
		};
	}

	private ensureHistory(session: BridgeSession): ChatMessageParam[] {
		if (!session.metadata) {
			session.metadata = {};
		}

		const metadata = session.metadata as Record<string, any> & {
			openaiHistory?: ChatMessageParam[];
		};

		if (!Array.isArray(metadata.openaiHistory)) {
			metadata.openaiHistory = [
				{
					role: 'system',
					content: SYSTEM_PROMPT
				}
			];
		}

		return metadata.openaiHistory;
	}

	private trimHistory(session: BridgeSession, history: ChatMessageParam[]): void {
		if (!session.metadata) {
			return;
		}

		if (history.length <= MAX_HISTORY_LENGTH) {
			return;
		}

		const metadata = session.metadata as Record<string, any> & {
			openaiHistory?: ChatMessageParam[];
		};

		metadata.openaiHistory = history.slice(-MAX_HISTORY_LENGTH);
	}

		private async getClient(): Promise<any | null> {
		if (!this.apiKey) {
			return null;
		}

			if (!this.clientPromise) {
				this.clientPromise = Promise.resolve()
					.then(() => new OpenAI({ apiKey: this.apiKey }))
					.catch((error) => {
						logger.error('Failed to initialize OpenAI SDK', { error });
						return null;
					});
			}

			return this.clientPromise;
	}

	private async invokeOpenAI(
		client: any,
		history: ChatMessageParam[],
		emit?: (event: BridgeEvent) => void
	): Promise<{
		response: any;
		accumulatedText: string;
		toolCalls: AccumulatedToolCall[];
	}> {
		const stream = await client.chat.completions.create({
			model: DEFAULT_MODEL,
			messages: history,
			tools: OPENAI_TOOLS,
			temperature: 0.1,
			stream: true
		});

		const toolCalls: AccumulatedToolCall[] = [];
		let textBuffer = '';

		for await (const chunk of stream as AsyncIterable<ChatChunk>) {
			const delta = chunk.choices?.[0]?.delta;
			const finishReason = chunk.choices?.[0]?.finish_reason;

			if (delta?.content) {
				const diff = delta.content.map((part) => part.text ?? '').join('');
				if (diff) {
					textBuffer += diff;
					if (emit) {
						emit(createStreamEvent(diff));
					}
				}
			}

			if (delta?.tool_calls) {
				delta.tool_calls.forEach((call, index) => {
					if (!toolCalls[index]) {
						toolCalls[index] = {
							id: call.id ?? randomUUID(),
							name: call.function?.name ?? 'vpa_status',
							arguments: ''
						} satisfies AccumulatedToolCall;
					}

					if (call.function?.name) {
						toolCalls[index].name = call.function.name;
					}

					if (call.function?.arguments) {
						toolCalls[index].arguments += call.function.arguments;
					}
				});
			}

			if (finishReason === 'stop' || finishReason === 'tool_calls') {
				break;
			}
		}

		const final = await stream.finalChatCompletion();
		const response = final.choices[0].message;

		return {
			response,
			accumulatedText: textBuffer,
			toolCalls
		};
	}
}

function parseAction(argsJson: string): string {
	try {
		const parsed = JSON.parse(argsJson);
		return typeof parsed?.action === 'string' ? parsed.action : 'modules';
	} catch (_error) {
		return 'modules';
	}
}

function parseParameters(argsJson: string): Record<string, any> {
	try {
		const parsed = JSON.parse(argsJson);
		return parsed?.parameters && typeof parsed.parameters === 'object'
			? parsed.parameters
			: {};
	} catch (_error) {
		return {};
	}
}

function extractAssistantContent(message: any): string {
	const content = message.content ?? [];
	const parts = Array.isArray(content) ? content : [{ type: 'text', text: String(content) }];
	return parts
		.map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
		.join('')
		.trim();
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
