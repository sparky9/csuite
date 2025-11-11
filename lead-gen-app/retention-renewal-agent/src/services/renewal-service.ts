import { withTransaction } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface RenewalAccountSummary {
  id: string;
  accountName: string;
  renewalDate: string | null;
  contractValue?: number;
  riskLevel?: string;
  healthScore?: number;
  daysUntilRenewal?: number;
}

export interface AtRiskAccountSummary extends RenewalAccountSummary {
  ownerId?: string;
  ownerName?: string;
  renewalProbability?: number;
  latestSnapshotDate?: string | null;
  metricsSnapshot?: Record<string, unknown> | null;
  scoreSource?: 'snapshot' | 'account';
}

export async function getUpcomingRenewals(windowDays: number, limit: number): Promise<RenewalAccountSummary[]> {
  const safeWindowDays = Number.isFinite(windowDays) ? Math.max(Math.floor(windowDays), 1) : 30;
  const safeLimit = Number.isFinite(limit) ? Math.max(Math.floor(limit), 1) : 20;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT
         ra.id,
         ra.account_name,
         ra.renewal_date,
         ra.contract_value,
         ra.risk_level,
         COALESCE(ra.health_score, rhs.composite_score) AS health_score
       FROM renewal_accounts ra
       LEFT JOIN LATERAL (
         SELECT composite_score
         FROM renewal_health_snapshots rhs
         WHERE rhs.account_id = ra.id
         ORDER BY rhs.snapshot_date DESC, rhs.created_at DESC
         LIMIT 1
       ) rhs ON TRUE
       WHERE ra.renewal_date IS NOT NULL
         AND ra.renewal_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($1::INT * INTERVAL '1 day'))
       ORDER BY ra.renewal_date ASC
       LIMIT $2`,
      [safeWindowDays, safeLimit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      accountName: row.account_name,
      renewalDate: row.renewal_date ? new Date(row.renewal_date).toISOString().slice(0, 10) : null,
      contractValue: row.contract_value != null ? Number(row.contract_value) : undefined,
      riskLevel: row.risk_level,
      healthScore: row.health_score != null ? Number(row.health_score) : undefined,
      daysUntilRenewal:
        row.renewal_date != null
          ? Math.max(
              0,
              Math.ceil(
                (new Date(row.renewal_date).getTime() - todayStartMs) /
                  (24 * 60 * 60 * 1000)
              )
            )
          : undefined,
    }));
  }).catch((error) => {
    logger.error('Failed to fetch upcoming renewals', {
      windowDays: safeWindowDays,
      limit: safeLimit,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  });
}

export async function getAtRiskAccounts(options: {
  includeWatch?: boolean;
  limit?: number;
} = {}): Promise<AtRiskAccountSummary[]> {
  const includeWatch = options.includeWatch ?? false;
  const limit = options.limit ?? 20;

  const safeLimit = Number.isFinite(limit) ? Math.max(Math.floor(limit), 1) : 20;
  const riskLevels = includeWatch ? ['critical', 'at_risk', 'watch'] : ['critical', 'at_risk'];

  try {
    const result = await withTransaction(async (client) => {
      const query = await client.query(
        `SELECT
           ra.id,
           ra.account_name,
           ra.renewal_date,
           ra.contract_value,
           ra.risk_level,
           ra.health_score,
           ra.owner_id,
           ra.owner_name,
           ra.renewal_probability,
           ra.metrics_snapshot,
           rhs.snapshot_date,
           rhs.composite_score
         FROM renewal_accounts ra
         LEFT JOIN LATERAL (
           SELECT snapshot_date, composite_score
             FROM renewal_health_snapshots rhs
            WHERE rhs.account_id = ra.id
            ORDER BY snapshot_date DESC, created_at DESC
            LIMIT 1
         ) rhs ON TRUE
         WHERE ra.risk_level = ANY($1::text[])
           AND (ra.status IS NULL OR ra.status = 'active')
         ORDER BY CASE ra.risk_level
                    WHEN 'critical' THEN 3
                    WHEN 'at_risk' THEN 2
                    WHEN 'watch' THEN 1
                    ELSE 0
                  END DESC,
                  COALESCE(rhs.composite_score, ra.health_score) ASC NULLS LAST,
                  ra.renewal_date ASC NULLS LAST
         LIMIT $2`,
        [riskLevels, safeLimit]
      );

      return query.rows;
    });

    return result.map((row: any) => {
      const renewalDate = row.renewal_date ? new Date(row.renewal_date).toISOString().slice(0, 10) : null;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const dayDiff = renewalDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(renewalDate).getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)
            )
          )
        : undefined;

      let metricsSnapshot: Record<string, unknown> | null = null;
      if (row.metrics_snapshot) {
        try {
          metricsSnapshot = typeof row.metrics_snapshot === 'string'
            ? JSON.parse(row.metrics_snapshot)
            : row.metrics_snapshot;
        } catch (error) {
          logger.warn('Failed to parse metrics snapshot JSON', {
            accountId: row.id,
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      const composite = row.composite_score != null ? Number(row.composite_score) : null;
      const accountScore = row.health_score != null ? Number(row.health_score) : null;

      return {
        id: row.id,
        accountName: row.account_name,
        renewalDate,
        contractValue: row.contract_value != null ? Number(row.contract_value) : undefined,
        riskLevel: row.risk_level,
        healthScore: composite ?? accountScore ?? undefined,
        daysUntilRenewal: dayDiff,
        ownerId: row.owner_id ?? undefined,
        ownerName: row.owner_name ?? undefined,
        renewalProbability: row.renewal_probability != null ? Number(row.renewal_probability) : undefined,
        latestSnapshotDate: row.snapshot_date ? new Date(row.snapshot_date).toISOString().slice(0, 10) : null,
        metricsSnapshot,
        scoreSource: composite != null ? 'snapshot' : accountScore != null ? 'account' : undefined,
      } as AtRiskAccountSummary;
    });
  } catch (error) {
    logger.error('Failed to fetch at-risk accounts', {
      includeWatch,
      limit: safeLimit,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}
