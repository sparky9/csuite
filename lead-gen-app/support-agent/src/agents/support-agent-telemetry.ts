/**
 * Persist support agent outcomes for auditing and feedback loops.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(currentDir, '..', '..', 'data');
export const SUPPORT_AGENT_EVENT_LOG = path.join(dataDir, 'support-agent-events.ndjson');

export interface SupportAgentEvent {
  timestamp: string;
  ticketId: string;
  outcome: string;
  summary: string;
  topScore: number;
  totalResults: number;
  autoEscalated: boolean;
  escalationReason?: string;
}

export async function recordSupportAgentEvent(event: SupportAgentEvent): Promise<void> {
  await fs.mkdir(path.dirname(SUPPORT_AGENT_EVENT_LOG), { recursive: true });
  const line = `${JSON.stringify(event)}\n`;
  await fs.appendFile(SUPPORT_AGENT_EVENT_LOG, line, 'utf8');
}
