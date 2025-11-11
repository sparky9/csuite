import { Adapter, AdapterMessage, AdapterResult, AdapterStatus } from './adapters/adapter.js';
import { LocalAdapter } from './adapters/local-adapter.js';
import { ClaudeApiAdapter } from './adapters/claude-api-adapter.js';
import { OpenAIAdapter } from './adapters/openai-adapter.js';
import { OllamaAdapter } from './adapters/ollama-adapter.js';
import { AdapterTelemetry, TelemetrySnapshot } from './telemetry/adapter-telemetry.js';
import { RuntimeConfig, RuntimeMode } from '../config/runtime.js';
import { BridgeEvent, BridgeSession } from './types.js';
import { logger } from '../utils/logger.js';

interface ProcessResult {
  adapterId: RuntimeMode;
  result: AdapterResult;
}

export class AdapterManager {
  private readonly adapters = new Map<RuntimeMode, Adapter>();
  private readonly runtimeConfig: RuntimeConfig;
  private readonly telemetry = new AdapterTelemetry();

  constructor(runtimeConfig: RuntimeConfig) {
    this.runtimeConfig = runtimeConfig;
    this.register(new LocalAdapter());
    this.register(new ClaudeApiAdapter());
    this.register(new OpenAIAdapter());
    this.register(new OllamaAdapter());
  }

  getTelemetry(): TelemetrySnapshot {
    return this.telemetry.snapshot();
  }

  getAdapter(adapterId: RuntimeMode): Adapter | undefined {
    return this.adapters.get(adapterId);
  }

  getStatuses(): AdapterStatus[] {
    return Array.from(this.adapters.values()).map((adapter) => adapter.getStatus());
  }

  selectAdapter(preferred?: RuntimeMode): AdapterStatus | undefined {
    const order = this.buildPriority(preferred);

    for (const adapterId of order) {
      const adapter = this.adapters.get(adapterId);
      if (!adapter) {
        continue;
      }

      const status = adapter.getStatus();
      if (status.available) {
        return status;
      }
    }

    return undefined;
  }

  async processMessage(
    session: BridgeSession,
    message: AdapterMessage,
    emit?: (event: BridgeEvent) => void
  ): Promise<ProcessResult> {
    const order = this.buildPriority(session.adapter as RuntimeMode);
    let lastError: unknown = null;

    for (const adapterId of order) {
      const adapter = this.adapters.get(adapterId);
      if (!adapter) {
        continue;
      }

      const status = adapter.getStatus();
      if (!status.available) {
        continue;
      }

      const start = Date.now();

      try {
        const result = await adapter.processMessage(session, message, emit);

        const completedAt = Date.now();
        this.telemetry.recordInvocation({
          adapterId,
          success: true,
          durationMs: completedAt - start,
          timestamp: completedAt
        });

        if (session.adapter !== adapterId) {
          logger.info('Bridge adapter switched', {
            sessionId: session.id,
            from: session.adapter,
            to: adapterId
          });
        }

        return {
          adapterId,
          result
        };
      } catch (error) {
        lastError = error;
        const completedAt = Date.now();
        this.telemetry.recordInvocation({
          adapterId,
          success: false,
          durationMs: completedAt - start,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: completedAt
        });
        logger.error('Bridge adapter failed', {
          sessionId: session.id,
          adapterId,
          error
        });

        if (!this.runtimeConfig.failoverEnabled) {
          break;
        }
      }
    }

    throw lastError ?? new Error('No available adapters');
  }

  private register(adapter: Adapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  private buildPriority(preferred?: RuntimeMode): RuntimeMode[] {
    const ordered = new Set<RuntimeMode>();

    if (preferred) {
      ordered.add(preferred);
    }

    this.runtimeConfig.adapterPriority.forEach((mode) => ordered.add(mode));

  // Ensure local adapters always kept as fallbacks
  ordered.add('ollama');
  ordered.add('claude-desktop');

    return Array.from(ordered.values());
  }
}
