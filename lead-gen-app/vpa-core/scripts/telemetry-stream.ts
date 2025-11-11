#!/usr/bin/env node
/// <reference types="node" />

import { pathToFileURL } from 'node:url';
import { appendFile } from 'node:fs/promises';

interface TelemetryCliOptions {
  bridgeUrl: string;
  intervalMs: number;
  count: number;
  outputPath?: string;
  pretty: boolean;
}

interface HeartbeatPayload {
  status: string;
  timestamp: string;
  adapters: unknown;
  telemetry?: unknown;
  [key: string]: unknown;
}

function parseArgs(argv: string[] = process.argv.slice(2)): TelemetryCliOptions {
  const options: TelemetryCliOptions = {
    bridgeUrl: process.env.BRIDGE_URL || 'http://127.0.0.1:4040',
    intervalMs: Number.parseInt(process.env.BRIDGE_TELEMETRY_INTERVAL || '60000', 10),
    count: Number.parseInt(process.env.BRIDGE_TELEMETRY_COUNT || '0', 10),
    outputPath: process.env.BRIDGE_TELEMETRY_OUT,
    pretty: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bridge' && argv[i + 1]) {
      options.bridgeUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--interval' && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(value) && value > 0) {
        options.intervalMs = value;
      }
      i += 1;
    } else if (arg === '--count' && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.count = value;
      }
      i += 1;
    } else if (arg === '--output' && argv[i + 1]) {
      options.outputPath = argv[i + 1];
      i += 1;
    } else if (arg === '--pretty') {
      options.pretty = true;
    }
  }

  return options;
}

async function fetchHeartbeat(bridgeUrl: string): Promise<HeartbeatPayload> {
  const response = await fetch(`${bridgeUrl}/uta/heartbeat`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Heartbeat request failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as HeartbeatPayload;
}

async function appendLine(path: string, content: string): Promise<void> {
  await appendFile(path, `${content}\n`, { encoding: 'utf8' });
}

async function main(): Promise<void> {
  const options = parseArgs();
  console.log('Starting telemetry stream', {
    bridgeUrl: options.bridgeUrl,
    intervalMs: options.intervalMs,
    count: options.count,
    outputPath: options.outputPath
  });

  let iteration = 0;
  const maxIterations = options.count > 0 ? options.count : Number.POSITIVE_INFINITY;

  while (iteration < maxIterations) {
    iteration += 1;
    try {
      const heartbeat = await fetchHeartbeat(options.bridgeUrl);
      const record = {
        capturedAt: new Date().toISOString(),
        bridgeUrl: options.bridgeUrl,
        heartbeat
      };

      const serialized = JSON.stringify(record);

      if (options.outputPath) {
        await appendLine(options.outputPath, serialized);
      }

      if (options.pretty || !options.outputPath) {
        console.log(JSON.stringify(record, null, 2));
      }
    } catch (error) {
      console.error('Telemetry capture failed', error instanceof Error ? error.message : error);
    }

    if (iteration >= maxIterations) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }
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
