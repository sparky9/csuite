import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BridgeEvent, BridgeSession } from './types.js';

export class SessionStore {
  private readonly sessions = new Map<string, BridgeSession>();

  createSession(userId: string, adapter: string, metadata?: Record<string, any>): BridgeSession {
    const id = randomUUID();
    const token = randomUUID();
    const conversationId = randomUUID();
    const now = new Date();

    const session: BridgeSession = {
      id,
      token,
      userId,
      adapter,
      conversationId,
      createdAt: now,
      lastActive: now,
      metadata,
      events: new EventEmitter()
    };

    this.sessions.set(id, session);
    return session;
  }

  updateAdapter(sessionId: string, adapter: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.adapter = adapter;
    session.lastActive = new Date();
  }

  get(sessionId: string): BridgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  validate(sessionId: string, token: string): BridgeSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.token !== token) {
      return undefined;
    }

    session.lastActive = new Date();
    return session;
  }

  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events.removeAllListeners();
      this.sessions.delete(sessionId);
    }
  }

  emit(sessionId: string, event: BridgeEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.lastActive = new Date();
    session.events.emit('event', event);
  }

  listActiveSessions(): BridgeSession[] {
    return Array.from(this.sessions.values());
  }
}
