#!/usr/bin/env node
/// <reference types="node" />

import { pathToFileURL } from 'node:url';

export interface CliOptions {
  adapter?: string;
  message: string;
  userId: string;
  bridgeUrl: string;
  timeoutMs: number;
}

interface SessionResponse {
  sessionId: string;
  sessionToken: string;
  adapter: string;
  conversationId: string;
}

export interface BridgeEvent {
  id: string;
  type: string;
  message?: { role: string; content: string };
  payload?: Record<string, unknown>;
}

function parseArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {
    bridgeUrl: process.env.BRIDGE_URL || 'http://127.0.0.1:4040',
    message: 'Give me a quick operations update.',
    userId: process.env.BRIDGE_TEST_USER || 'adapter-integration-test',
    timeoutMs: Number.parseInt(process.env.BRIDGE_TEST_TIMEOUT || '120000', 10)
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--adapter' && argv[i + 1]) {
      options.adapter = argv[i + 1];
      i += 1;
    } else if (arg === '--message' && argv[i + 1]) {
      options.message = argv[i + 1];
      i += 1;
    } else if (arg === '--user' && argv[i + 1]) {
      options.userId = argv[i + 1];
      i += 1;
    } else if (arg === '--bridge' && argv[i + 1]) {
      options.bridgeUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--timeout' && argv[i + 1]) {
      options.timeoutMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
    }
  }

  return options;
}

async function createSession(baseUrl: string, userId: string, adapter?: string): Promise<SessionResponse> {
  const response = await fetch(`${baseUrl}/uta/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, adapter })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to create session: ${response.status} ${detail}`);
  }

  return (await response.json()) as SessionResponse;
}

async function sendMessage(baseUrl: string, session: SessionResponse, content: string): Promise<void> {
  const response = await fetch(`${baseUrl}/uta/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      token: session.sessionToken,
      message: { content }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send message: ${response.status} ${detail}`);
  }
}

async function streamSession(
  baseUrl: string,
  sessionId: string,
  timeoutMs: number
): Promise<BridgeEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${baseUrl}/uta/session/${sessionId}/stream`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal
  });

  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    throw new Error(`Failed to open event stream: ${response.status}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  const events: BridgeEvent[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator).trim();
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');

        const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) {
          continue;
        }

        const payload = dataLine.slice(5).trim();
        if (!payload) {
          continue;
        }

        try {
          const event = JSON.parse(payload) as BridgeEvent;
          events.push(event);

          if (event.type === 'message' && event.message?.role === 'assistant') {
            controller.abort();
          }
        } catch (error) {
          console.warn('Failed to parse SSE event', { error, payload });
        }
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }

  return events;
}

export interface AdapterTestResult {
  options: CliOptions;
  session: SessionResponse;
  events: BridgeEvent[];
}

export async function runAdapterTest(partial: Partial<CliOptions> = {}): Promise<AdapterTestResult> {
  const options: CliOptions = {
    bridgeUrl: partial.bridgeUrl ?? process.env.BRIDGE_URL ?? 'http://127.0.0.1:4040',
    message: partial.message ?? 'Give me a quick operations update.',
    userId: partial.userId ?? process.env.BRIDGE_TEST_USER ?? 'adapter-integration-test',
    timeoutMs: partial.timeoutMs ?? Number.parseInt(process.env.BRIDGE_TEST_TIMEOUT || '120000', 10),
    adapter: partial.adapter ?? process.env.BRIDGE_TEST_ADAPTER
  };

  const session = await createSession(options.bridgeUrl, options.userId, options.adapter);
  const streamPromise = streamSession(options.bridgeUrl, session.sessionId, options.timeoutMs);
  await sendMessage(options.bridgeUrl, session, options.message);
  const events = await streamPromise;

  return {
    options,
    session,
    events
  };
}

async function main(): Promise<void> {
  const cliOptions = parseArgs();
  console.log('Connecting to bridge', { url: cliOptions.bridgeUrl, adapter: cliOptions.adapter });
  const { session, events } = await runAdapterTest(cliOptions);

  console.log('Session established', session);
  console.log('--- Streamed Events ---');
  for (const event of events) {
    console.log(JSON.stringify(event, null, 2));
  }

  console.log('Adapter integration test finished');
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
