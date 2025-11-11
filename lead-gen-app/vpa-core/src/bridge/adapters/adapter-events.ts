import { randomUUID } from 'node:crypto';
import { BridgeEvent } from '../types.js';

export function createStreamEvent(delta: string): BridgeEvent {
  return {
    id: randomUUID(),
    type: 'status',
    payload: {
      type: 'assistant_stream',
      delta
    }
  } satisfies BridgeEvent;
}

export function createToolStatusEvent(tool: string, action: string): BridgeEvent {
  return {
    id: randomUUID(),
    type: 'status',
    payload: {
      type: 'tool_invocation',
      tool,
      action
    }
  } satisfies BridgeEvent;
}

export function createToolResultEvent(tool: string, action: string, data: any): BridgeEvent {
  return {
    id: randomUUID(),
    type: 'tool_result',
    payload: {
      toolName: tool,
      action,
      data
    }
  } satisfies BridgeEvent;
}