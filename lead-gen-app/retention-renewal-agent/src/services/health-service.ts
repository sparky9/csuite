import { withTransaction } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { sendRenewalAlert } from './notification-service.js';
import type { RenewalAlertPayload } from './notification-service.js';

export interface HealthSignalInput {
  accountId: string;
  source: 'usage' | 'support' | 'nps' | 'custom';
  capturedAt: string;
  payload: Record<string, unknown>;
}

const SIGNAL_WEIGHTS: Record<HealthSignalInput['source'], number> = {
  usage: 0.4,
  support: 0.2,
  nps: 0.3,
  custom: 0.1,
};

const RISK_SEVERITY_ORDER: Record<string, number> = {
  unknown: 0,
  healthy: 1,
  watch: 2,
  at_risk: 3,
  critical: 4,
};

interface AccountAggregate {
  accountId: string;
  usageScores: number[];
  supportScores: number[];
  sentimentScores: number[];
  customScores: number[];
  signals: HealthSignalInput[];
  latestCapturedAt: Date | null;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractScore(signal: HealthSignalInput): number | null {
  const payload = signal.payload ?? {};
  const candidateKeys = ['score', 'value', 'percentage', 'percent'];

  for (const key of candidateKeys) {
    const potential = (payload as any)[key];
    if (typeof potential === 'number') {
      return clampScore(potential);
    }
  }

  if (signal.source === 'nps') {
    const rating = (payload as any).rating;
    if (typeof rating === 'number') {
      // Convert NPS scale (-100 to 100 or -10 to 10) to 0-100 scoreboard.
      if (rating >= -10 && rating <= 10) {
        return clampScore(((rating + 10) / 20) * 100);
      }
      if (rating >= -100 && rating <= 100) {
        return clampScore(((rating + 100) / 200) * 100);
      }
    }
  }

  if (signal.source === 'usage') {
    const activeUsers = (payload as any).activeUsers;
    const licensedSeats = (payload as any).licensedSeats;
    if (typeof activeUsers === 'number' && typeof licensedSeats === 'number' && licensedSeats > 0) {
      return clampScore((activeUsers / licensedSeats) * 100);
    }
  }

  if (signal.source === 'support') {
    const csat = (payload as any).csat;
    if (typeof csat === 'number') {
      return clampScore(csat * 100);
    }
  }

  return null;
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1));
}

function deriveRiskLevel(score: number | null): string {
  if (score == null) {
    return 'unknown';
  }

  if (score >= 80) {
    return 'healthy';
  }
  if (score >= 60) {
    return 'watch';
  }
  if (score >= 40) {
    return 'at_risk';
  }
  return 'critical';
}

export async function ingestSignals(signals: HealthSignalInput[]): Promise<void> {
  if (signals.length === 0) {
    if (typeof logger.debug === 'function') {
      logger.debug('No signals received for ingestion');
    }
    return;
  }

  const aggregates = new Map<string, AccountAggregate>();

  for (const signal of signals) {
    const aggregate = aggregates.get(signal.accountId) ?? {
      accountId: signal.accountId,
      usageScores: [],
      supportScores: [],
      sentimentScores: [],
      customScores: [],
      signals: [],
      latestCapturedAt: null,
    };

    const score = extractScore(signal);
    if (score != null) {
      if (signal.source === 'usage') {
        aggregate.usageScores.push(score);
      } else if (signal.source === 'support') {
        aggregate.supportScores.push(score);
      } else if (signal.source === 'nps') {
        aggregate.sentimentScores.push(score);
      } else {
        aggregate.customScores.push(score);
      }
    }

    aggregate.signals.push(signal);

    const capturedDate = new Date(signal.capturedAt ?? Date.now());
    if (!Number.isNaN(capturedDate.getTime())) {
      if (!aggregate.latestCapturedAt || aggregate.latestCapturedAt < capturedDate) {
        aggregate.latestCapturedAt = capturedDate;
      }
    }

    aggregates.set(signal.accountId, aggregate);
  }

  const accountsWithScores = Array.from(aggregates.values()).filter((aggregate) => {
    return (
      aggregate.usageScores.length > 0 ||
      aggregate.supportScores.length > 0 ||
      aggregate.sentimentScores.length > 0 ||
      aggregate.customScores.length > 0
    );
  });

  if (accountsWithScores.length === 0) {
    logger.warn('Signals received but no numeric scores extracted', {
      count: signals.length,
    });
    return;
  }

  const alertsToDispatch: RenewalAlertPayload[] = [];

  await withTransaction(async (client) => {
    for (const aggregate of accountsWithScores) {
      const usageScore = average(aggregate.usageScores);
      const supportScore = average(aggregate.supportScores);
      const sentimentScore = average(aggregate.sentimentScores);
      const customScore = average(aggregate.customScores);

      const weightedComponents: number[] = [];
      const componentWeights: number[] = [];

      if (usageScore != null) {
        weightedComponents.push(usageScore * SIGNAL_WEIGHTS.usage);
        componentWeights.push(SIGNAL_WEIGHTS.usage);
      }
      if (supportScore != null) {
        weightedComponents.push(supportScore * SIGNAL_WEIGHTS.support);
        componentWeights.push(SIGNAL_WEIGHTS.support);
      }
      if (sentimentScore != null) {
        weightedComponents.push(sentimentScore * SIGNAL_WEIGHTS.nps);
        componentWeights.push(SIGNAL_WEIGHTS.nps);
      }
      if (customScore != null) {
        weightedComponents.push(customScore * SIGNAL_WEIGHTS.custom);
        componentWeights.push(SIGNAL_WEIGHTS.custom);
      }

      const compositeScore = componentWeights.length
        ? Number((weightedComponents.reduce((total, value) => total + value, 0) / componentWeights.reduce((total, value) => total + value, 0)).toFixed(1))
        : null;

      const snapshotDate = aggregate.latestCapturedAt ?? new Date();

      const breakdown = {
        usage: aggregate.usageScores,
        support: aggregate.supportScores,
        sentiment: aggregate.sentimentScores,
        custom: aggregate.customScores,
        compositeScore,
        weights: SIGNAL_WEIGHTS,
        rawSignals: aggregate.signals,
      };

      const accountResult = await client.query(
        `SELECT account_name, renewal_date, risk_level, health_score
           FROM renewal_accounts
          WHERE id = $1
          FOR UPDATE`,
        [aggregate.accountId]
      );

      if (!accountResult.rowCount) {
        logger.warn('Health snapshot ingested for unknown account', {
          accountId: aggregate.accountId,
        });
        continue;
      }

      const accountRow = accountResult.rows[0];
      const previousRisk: string = accountRow.risk_level ?? 'unknown';
      const previousScore = accountRow.health_score != null ? Number(accountRow.health_score) : null;
      const accountName: string = accountRow.account_name ?? aggregate.accountId;
      const renewalDateValue = accountRow.renewal_date
        ? new Date(accountRow.renewal_date as any)
        : null;

      await client.query(
        `INSERT INTO renewal_health_snapshots (
            account_id,
            snapshot_date,
            usage_score,
            support_score,
            sentiment_score,
            financial_score,
            composite_score,
            signal_breakdown
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [
          aggregate.accountId,
          snapshotDate,
          usageScore,
          supportScore,
          sentimentScore,
          customScore,
          compositeScore,
          JSON.stringify(breakdown),
        ]
      );

      if (compositeScore != null) {
        const riskLevel = deriveRiskLevel(compositeScore);

        const updateResult = await client.query(
          `UPDATE renewal_accounts
             SET health_score = $2,
                 risk_level = $3,
                 metrics_snapshot = ($4)::JSONB,
                 updated_at = NOW()
           WHERE id = $1`,
          [
            aggregate.accountId,
            compositeScore,
            riskLevel,
            JSON.stringify({
              healthScore: compositeScore,
              usageScore,
              supportScore,
              sentimentScore,
              customScore,
              capturedAt: snapshotDate.toISOString(),
            }),
          ]
        );

        if (updateResult.rowCount === 0) {
          logger.warn('Health snapshot failed to update account record', {
            accountId: aggregate.accountId,
          });
        }

        await client.query(
          `INSERT INTO renewal_events (
             account_id,
             event_type,
             description,
             metadata,
             occurred_at
           ) VALUES ($1, $2, $3, $4::JSONB, $5)`,
          [
            aggregate.accountId,
            'health_score_updated',
            'Health score recalculated from signal ingestion.',
            JSON.stringify({
              previousRisk,
              newRisk: riskLevel,
              previousScore,
              newScore: compositeScore,
              snapshotDate: snapshotDate.toISOString(),
            }),
            snapshotDate,
          ]
        );

        const previousSeverity = RISK_SEVERITY_ORDER[previousRisk] ?? 0;
        const newSeverity = RISK_SEVERITY_ORDER[riskLevel] ?? 0;

        if (newSeverity >= RISK_SEVERITY_ORDER.at_risk && newSeverity >= previousSeverity) {
          const renewalDate = renewalDateValue
            ? renewalDateValue.toISOString().slice(0, 10)
            : 'Not set';
          const summaryParts = [
            `Score ${previousScore ?? 'n/a'} → ${compositeScore}`,
          ];

          if (previousRisk !== riskLevel) {
            summaryParts.unshift(`Risk ${previousRisk} → ${riskLevel}`);
          }

          alertsToDispatch.push({
            accountId: aggregate.accountId,
            accountName,
            renewalDate,
            riskLevel,
            summary: summaryParts.join(' | '),
          });
        }
      }
    }
  });

  if (alertsToDispatch.length > 0) {
    for (const alert of alertsToDispatch) {
      try {
        await sendRenewalAlert(alert);
      } catch (error: any) {
        logger.error('Failed to deliver renewal alert', {
          accountId: alert.accountId,
          error: error?.message ?? error,
        });
      }
    }
  }

  logger.info('Health signals ingested', {
    accountsUpdated: accountsWithScores.length,
    totalSignals: signals.length,
    alertsDispatched: alertsToDispatch.length,
  });
}

export async function calculateHealthScore(accountId: string): Promise<number | null> {
  const result = await withTransaction(async (client) => {
    const snapshot = await client.query(
      `SELECT composite_score
         FROM renewal_health_snapshots
        WHERE account_id = $1
        ORDER BY snapshot_date DESC, created_at DESC
        LIMIT 1`,
      [accountId]
    );

    if (snapshot.rowCount && snapshot.rows[0].composite_score != null) {
      return Number(snapshot.rows[0].composite_score);
    }

    const fallback = await client.query(
      `SELECT health_score FROM renewal_accounts WHERE id = $1`,
      [accountId]
    );

    if (fallback.rowCount && fallback.rows[0].health_score != null) {
      return Number(fallback.rows[0].health_score);
    }

    return null;
  });

  return result;
}
