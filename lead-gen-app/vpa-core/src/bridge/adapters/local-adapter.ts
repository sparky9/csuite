import { randomUUID } from 'node:crypto';
import { Adapter, AdapterMessage, AdapterResult } from './adapter.js';
import { BridgeEvent, BridgeSession } from '../types.js';
import { parseAndRoute, executeVPATool } from '../../orchestrator.js';
import { RuntimeMode } from '../../config/runtime.js';
import { createAssistantEvent } from './event-factory.js';

export class LocalAdapter implements Adapter {
  public readonly id: RuntimeMode = 'claude-desktop';

  getStatus() {
    return {
      id: this.id,
      available: true,
      detail: 'Direct orchestrator execution'
    };
  }

  async processMessage(
    session: BridgeSession,
    message: AdapterMessage,
    _emit?: (event: BridgeEvent) => void
  ): Promise<AdapterResult> {
    const intent = await parseAndRoute(message.content, session.userId);
    const result = await executeVPATool(intent.tool, intent.action, intent.parameters, session.userId);

    const assistantEvent = createAssistantEvent(randomUUID(), intent, result);

    return {
      events: [assistantEvent]
    };
  }
}
