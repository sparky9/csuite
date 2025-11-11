import express from 'express';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { SessionStore } from './session-store.js';
import { BridgeEvent } from './types.js';
import { logger } from '../utils/logger.js';
import { loadRuntimeConfig } from '../config/runtime.js';
import { AdapterManager } from './adapter-manager.js';
import { AdapterMessage } from './adapters/adapter.js';
import { RuntimeMode } from '../config/runtime.js';

const createSessionSchema = z.object({
  userId: z.string().min(1),
  adapter: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const messageSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().uuid(),
  message: z.object({
    content: z.string().min(1),
    voiceHint: z.string().optional()
  })
});

const toolResultSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().uuid(),
  toolName: z.string().min(1),
  payload: z.any()
});

export function createBridgeApp() {
  const app = express();
  const sessions = new SessionStore();
  const runtimeConfig = loadRuntimeConfig();
  const adapterManager = new AdapterManager(runtimeConfig);

  app.use(express.json({ limit: '1mb' }));

  app.post('/uta/session', (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid session payload', details: parsed.error.flatten() });
    }

    const requestedAdapter = asRuntimeMode(parsed.data.adapter, runtimeConfig.defaultMode);
    const selectedAdapter = adapterManager.selectAdapter(requestedAdapter);

    if (!selectedAdapter) {
      return res.status(503).json({ error: 'No available adapters' });
    }

    const session = sessions.createSession(parsed.data.userId, selectedAdapter.id, parsed.data.metadata);

    logger.info('Bridge session created', {
      sessionId: session.id,
      adapter: session.adapter,
      userId: session.userId
    });

    res.status(201).json({
      sessionId: session.id,
      sessionToken: session.token,
      adapter: session.adapter,
      conversationId: session.conversationId
    });
  });

  app.post('/uta/message', async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid message payload', details: parsed.error.flatten() });
    }

    const session = sessions.validate(parsed.data.sessionId, parsed.data.token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session or token' });
    }

    const userEvent: BridgeEvent = {
      id: randomUUID(),
      type: 'message',
      message: {
        role: 'user',
        content: parsed.data.message.content,
        voiceHint: parsed.data.message.voiceHint
      }
    };

    sessions.emit(session.id, userEvent);

    const adapterMessage: AdapterMessage = {
      content: parsed.data.message.content,
      voiceHint: parsed.data.message.voiceHint
    };

    try {
      const { adapterId, result } = await adapterManager.processMessage(
        session,
        adapterMessage,
        (event) => sessions.emit(session.id, event)
      );

      if (session.adapter !== adapterId) {
        sessions.updateAdapter(session.id, adapterId);
        session.adapter = adapterId;
      }

      const events = result.events ?? [];
      events.forEach((event) => sessions.emit(session.id, event));

      res.json({
        status: 'accepted',
        eventId: events.length ? events[events.length - 1].id : null,
        adapter: adapterId
      });
    } catch (error) {
      logger.error('Bridge message handling failed', {
        error,
        sessionId: session.id
      });

      const errorEvent: BridgeEvent = {
        id: randomUUID(),
        type: 'status',
        payload: {
          level: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      sessions.emit(session.id, errorEvent);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  app.post('/uta/tool-result', (req, res) => {
    const parsed = toolResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid tool payload', details: parsed.error.flatten() });
    }

    const session = sessions.validate(parsed.data.sessionId, parsed.data.token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session or token' });
    }

    const event: BridgeEvent = {
      id: randomUUID(),
      type: 'tool_result',
      payload: {
        toolName: parsed.data.toolName,
        data: parsed.data.payload
      }
    };

    sessions.emit(session.id, event);
    res.json({ status: 'accepted', eventId: event.id });
  });

  app.get('/uta/session/:id/stream', (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: BridgeEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 20000);

    session.events.on('event', sendEvent);

    req.on('close', () => {
      clearInterval(heartbeat);
      session.events.off('event', sendEvent);
    });
  });

  app.get('/uta/heartbeat', (_req, res) => {
    const activeSessions = sessions.listActiveSessions().map((session) => ({
      id: session.id,
      adapter: session.adapter,
      lastActive: session.lastActive,
      userId: session.userId
    }));

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeSessions,
      runtime: runtimeConfig,
      adapters: adapterManager.getStatuses(),
      telemetry: adapterManager.getTelemetry()
    });
  });

  app.delete('/uta/session/:id', (req, res) => {
    const sessionId = req.params.id;
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.status(400).json({ error: 'Missing session token' });
    }

    const session = sessions.validate(sessionId, token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session or token' });
    }

    sessions.delete(sessionId);
    res.status(204).end();
  });

  return app;
}
function asRuntimeMode(value: string | undefined, fallback: RuntimeMode): RuntimeMode {
  const modes: RuntimeMode[] = ['claude-desktop', 'claude-api', 'openai', 'gemini', 'ollama'];
  if (!value) {
    return fallback;
  }

  return modes.includes(value as RuntimeMode) ? (value as RuntimeMode) : fallback;
}

const isDirectExecution = (): boolean => {
  if (!process.argv[1]) {
    return false;
  }

  const directPath = pathToFileURL(process.argv[1]).href;
  if (directPath === import.meta.url) {
    return true;
  }

  const normalized = path.normalize(process.argv[1]);
  return normalized.endsWith(path.normalize('src/bridge/server.ts')) ||
    normalized.endsWith(path.normalize('dist/bridge/server.js'));
};

if (isDirectExecution()) {
  const port = Number.parseInt(process.env.BRIDGE_PORT || '4040', 10);
  const app = createBridgeApp();

  app.listen(port, () => {
    logger.info('Bridge server listening', { port });
  });
}
