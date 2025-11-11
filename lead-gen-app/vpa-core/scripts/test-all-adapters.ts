#!/usr/bin/env node
/// <reference types="node" />

import { pathToFileURL } from 'node:url';
import { runAdapterTest } from './test-adapters.js';

interface AdapterStatus {
  id: string;
  available: boolean;
  detail?: string;
}

interface HeartbeatResponse {
  adapters: AdapterStatus[];
  telemetry?: unknown;
}

interface AllTestCliOptions {
  bridgeUrl: string;
  message: string;
  userId: string;
  timeoutMs: number;
  adapters?: string[];
  includeUnavailable: boolean;
}

function parseArgs(argv: string[] = process.argv.slice(2)): AllTestCliOptions {
  const options: AllTestCliOptions = {
    bridgeUrl: process.env.BRIDGE_URL || 'http://127.0.0.1:4040',
    message: 'Give me a quick operations update.',
    userId: process.env.BRIDGE_TEST_USER || 'adapter-integration-test-suite',
    timeoutMs: Number.parseInt(process.env.BRIDGE_TEST_TIMEOUT || '120000', 10),
    includeUnavailable: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bridge' && argv[i + 1]) {
      options.bridgeUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--message' && argv[i + 1]) {
      options.message = argv[i + 1];
      i += 1;
    } else if (arg === '--user' && argv[i + 1]) {
      options.userId = argv[i + 1];
      i += 1;
    } else if (arg === '--timeout' && argv[i + 1]) {
      options.timeoutMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--adapters' && argv[i + 1]) {
      options.adapters = argv[i + 1]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      i += 1;
    } else if (arg === '--include-unavailable') {
      options.includeUnavailable = true;
    }
  }

  return options;
}

async function fetchAdapterStatuses(bridgeUrl: string): Promise<AdapterStatus[]> {
  try {
    const response = await fetch(`${bridgeUrl}/uta/heartbeat`);
    if (!response.ok) {
      throw new Error(`Heartbeat request failed: ${response.status}`);
    }

    const heartbeat = (await response.json()) as HeartbeatResponse;
    return heartbeat.adapters ?? [];
  } catch (error) {
    console.warn('Unable to fetch heartbeat; proceeding with provided adapters only.', error);
    return [];
  }
}

interface AdapterSummary {
  id: string;
  status: 'success' | 'failed' | 'skipped';
  detail?: string;
  events?: number;
  durationMs?: number;
}

async function runSuite(options: AllTestCliOptions): Promise<AdapterSummary[]> {
  const statuses = await fetchAdapterStatuses(options.bridgeUrl);
  const selected = new Set<string>();

  if (options.adapters && options.adapters.length > 0) {
    options.adapters.forEach((id) => selected.add(id));
  } else {
    statuses
      .filter((status) => status.available)
      .forEach((status) => selected.add(status.id));
  }

  if (selected.size === 0) {
    console.warn('No adapters selected. Provide --adapters or ensure heartbeat is reachable.');
    return [];
  }

  const summaries: AdapterSummary[] = [];

  for (const adapterId of selected) {
    const status = statuses.find((entry) => entry.id === adapterId);
    if (!options.includeUnavailable && status && !status.available) {
      summaries.push({
        id: adapterId,
        status: 'skipped',
        detail: status.detail ?? 'Adapter unavailable'
      });
      continue;
    }

    const start = Date.now();
    try {
      const result = await runAdapterTest({
        adapter: adapterId,
        bridgeUrl: options.bridgeUrl,
        message: options.message,
        timeoutMs: options.timeoutMs,
        userId: `${options.userId}-${adapterId}`
      });

      summaries.push({
        id: adapterId,
        status: 'success',
        events: result.events.length,
        durationMs: Date.now() - start
      });
    } catch (error) {
      summaries.push({
        id: adapterId,
        status: 'failed',
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return summaries;
}

async function main(): Promise<void> {
  const options = parseArgs();
  console.log('Running adapter harness suite', {
    bridgeUrl: options.bridgeUrl,
    adapters: options.adapters,
    includeUnavailable: options.includeUnavailable
  });

  const summaries = await runSuite(options);

  if (summaries.length === 0) {
    console.log('No adapters were exercised.');
    return;
  }

  console.log('--- Adapter Harness Summary ---');
  for (const summary of summaries) {
    console.log(
      JSON.stringify(
        {
          adapter: summary.id,
          status: summary.status,
          detail: summary.detail,
          events: summary.events,
          durationMs: summary.durationMs
        },
        null,
        2
      )
    );
  }

  const failures = summaries.filter((summary) => summary.status === 'failed');
  if (failures.length > 0) {
    process.exitCode = 1;
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
