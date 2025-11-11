import { EventEmitter } from 'node:events';

export type BridgeRole = 'user' | 'assistant' | 'tool';

export interface BridgeMessage {
  role: BridgeRole;
  content: string;
  voiceHint?: string;
}

export interface BridgeEvent {
  id: string;
  type: 'message' | 'tool_result' | 'status';
  message?: BridgeMessage;
  payload?: Record<string, any>;
}

export interface BridgeSession {
  id: string;
  token: string;
  userId: string;
  adapter: string;
  conversationId: string;
  createdAt: Date;
  lastActive: Date;
  metadata?: Record<string, any>;
  events: EventEmitter;
}
