#!/usr/bin/env node
/// <reference types="node" />
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRuntimeConfig } from '../src/config/runtime.js';
import { AdapterManager } from '../src/bridge/adapter-manager.js';

interface EnvUpdates {
  [key: string]: string | undefined;
}

function sanitizeList(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
}

async function applyEnvUpdates(envPath: string, updates: EnvUpdates): Promise<void> {
  const existing = existsSync(envPath) ? await readFile(envPath, 'utf8') : '';
  const lines = existing.split(/\r?\n/).filter((line) => line.length > 0);
  const map = new Map<string, string>();

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.includes('=')) {
      map.set(line, line);
      continue;
    }

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    map.set(key, `${key}=${value}`);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'undefined' || value === '') {
      continue;
    }

    map.set(key, `${key}=${value}`);
  }

  const orderedKeys = Array.from(map.keys());
  const outputLines = orderedKeys.map((key) => {
    const value = map.get(key);
    return value ?? key;
  });

  await writeFile(envPath, `${outputLines.join('\n')}\n`, 'utf8');
}

async function main(): Promise<void> {
  const runtimeConfig = loadRuntimeConfig();
  const adapterManager = new AdapterManager(runtimeConfig);
  const statuses = adapterManager.getStatuses();

  console.log('Adapter availability:');
  statuses.forEach((status) => {
    console.log(`- ${status.id}: ${status.available ? 'available' : 'unavailable'} (${status.detail ?? 'no detail'})`);
  });
  console.log('Current priority:', runtimeConfig.adapterPriority.join(', '));

  const rl = createInterface({ input, output });

  try {
    const preferred = await rl.question(`Preferred adapter [${runtimeConfig.defaultMode}]: `);
    const priority = await rl.question('Adapter priority list (comma separated, blank to keep current): ');
    const ollamaUrl = await rl.question(`Ollama base URL [${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}]: `);
    const ollamaModel = await rl.question(`Ollama model [${process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct'}]: `);

    const envPath = path.resolve(process.cwd(), '.env');
    const updates: EnvUpdates = {};

    if (preferred.trim()) {
      updates.VPA_RUNTIME_MODE = preferred.trim();
    }

    if (priority.trim()) {
      updates.VPA_ADAPTER_PRIORITY = sanitizeList(priority);
    }

    if (ollamaUrl.trim()) {
      updates.OLLAMA_BASE_URL = ollamaUrl.trim();
    }

    if (ollamaModel.trim()) {
      updates.OLLAMA_MODEL = ollamaModel.trim();
    }

    const shouldWrite = await rl.question(`Write updates to ${envPath}? (y/N): `);

    if (shouldWrite.trim().toLowerCase() === 'y') {
      await applyEnvUpdates(envPath, updates);
      console.log(`Updated ${envPath}`);
    } else {
      console.log('Skipped writing to .env. Suggested values:');
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          console.log(`${key}=${value}`);
        }
      }
    }
  } finally {
    await rl.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
