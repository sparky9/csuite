import { RuntimeMode } from '../../config/runtime.js';

export interface AdapterInvocation {
  readonly adapterId: RuntimeMode;
  readonly durationMs: number;
  readonly success: boolean;
  readonly timestamp: number;
  readonly error?: string;
}

export interface TelemetrySnapshot {
  totals: Partial<Record<RuntimeMode, { success: number; failure: number; averageMs: number }>>;
  recent: AdapterInvocation[];
  lastUpdated: number | null;
}

const MAX_RECENT = 50;

export class AdapterTelemetry {
  private readonly recent: AdapterInvocation[] = [];
  private readonly totals = new Map<RuntimeMode, { success: number; failure: number; totalMs: number }>();
  private lastUpdated: number | null = null;

  recordInvocation(metric: AdapterInvocation): void {
    this.recent.push(metric);
    if (this.recent.length > MAX_RECENT) {
      this.recent.shift();
    }

    const existing = this.totals.get(metric.adapterId) ?? { success: 0, failure: 0, totalMs: 0 };
    if (metric.success) {
      existing.success += 1;
    } else {
      existing.failure += 1;
    }
    existing.totalMs += metric.durationMs;
    this.totals.set(metric.adapterId, existing);
    this.lastUpdated = metric.timestamp;
  }

  snapshot(): TelemetrySnapshot {
    const totals: TelemetrySnapshot['totals'] = {};

    for (const [adapterId, stats] of this.totals.entries()) {
      const calls = stats.success + stats.failure;
      totals[adapterId] = {
        success: stats.success,
        failure: stats.failure,
        averageMs: calls ? Math.round(stats.totalMs / calls) : 0
      };
    }

    return {
      totals,
      recent: [...this.recent],
      lastUpdated: this.lastUpdated
    };
  }
}
