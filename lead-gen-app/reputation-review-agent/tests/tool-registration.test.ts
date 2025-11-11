import { describe, expect, it } from 'vitest';
import { REPUTATION_HANDLERS, REPUTATION_TOOLS } from '../src/tools/index.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

describe('Reputation tool registration', () => {
  it('exposes tools with matching handlers', () => {
    expect(REPUTATION_TOOLS.length).toBeGreaterThan(0);

    const seenNames = new Set<string>();

    for (const tool of REPUTATION_TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(seenNames.has(tool.name)).toBe(false);
      seenNames.add(tool.name);

      expect(isRecord(tool.inputSchema)).toBe(true);
      const handler = REPUTATION_HANDLERS[tool.name];
      expect(typeof handler).toBe('function');
    }

    expect(seenNames.size).toBe(REPUTATION_TOOLS.length);
  });
});
