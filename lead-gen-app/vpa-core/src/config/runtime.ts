import { z } from 'zod';

const RuntimeModeSchema = z.enum(['claude-desktop', 'claude-api', 'openai', 'gemini', 'ollama']);

export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

const DEFAULT_PRIORITY: RuntimeMode[] = ['claude-desktop', 'claude-api', 'openai', 'gemini', 'ollama'];

export interface RuntimeConfig {
  defaultMode: RuntimeMode;
  adapterPriority: RuntimeMode[];
  failoverEnabled: boolean;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const requestedMode = parseRuntimeMode(process.env.VPA_RUNTIME_MODE);
  const priority = parsePriorityList(process.env.VPA_ADAPTER_PRIORITY);
  const failoverEnabled = process.env.VPA_FAILOVER_ENABLED !== 'false';

  return {
    defaultMode: requestedMode ?? DEFAULT_PRIORITY[0],
    adapterPriority: priority.length ? priority : buildPriority(requestedMode),
    failoverEnabled
  };
}

export function isLocalRuntime(mode: RuntimeMode): boolean {
  return mode === 'claude-desktop' || mode === 'ollama';
}

function parseRuntimeMode(value: string | undefined): RuntimeMode | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  try {
    return RuntimeModeSchema.parse(normalized);
  } catch (_error) {
    return undefined;
  }
}

function parsePriorityList(value: string | undefined): RuntimeMode[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .map((entry) => parseRuntimeMode(entry))
    .filter((mode): mode is RuntimeMode => Boolean(mode));
}

function buildPriority(defaultMode: RuntimeMode | undefined): RuntimeMode[] {
  if (!defaultMode) {
    return DEFAULT_PRIORITY;
  }

  const priority = new Set<RuntimeMode>([defaultMode]);
  DEFAULT_PRIORITY.forEach((mode) => priority.add(mode));

  return Array.from(priority.values());
}
