import type pg from 'pg';
import { withTransaction } from '../db/client.js';
import { getDefaultCurrency, getDefaultHourlyRate } from '../utils/config.js';
import { recordEvent } from './events.js';
import type { RateCard } from '../types/index.js';

interface RateCardRow {
  id: string;
  user_id: string;
  client_id: string | null;
  project_name: string | null;
  hourly_rate: string;
  currency: string;
  effective_date: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SetRateCardInput {
  userId: string;
  clientId?: string | null;
  projectName?: string | null;
  hourlyRate: number;
  currency?: string;
  effectiveDate?: string;
}

export type RateCardResult = RateCard;

function mapRateCard(row: RateCardRow): RateCardResult {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    projectName: row.project_name,
    hourlyRate: Number(row.hourly_rate),
    currency: row.currency,
    effectiveDate: row.effective_date,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function setRateCard(params: SetRateCardInput): Promise<RateCardResult> {
  const {
    userId,
    clientId = null,
    projectName = null,
    hourlyRate,
    currency,
    effectiveDate
  } = params;

  const normalizedCurrency = (currency ?? getDefaultCurrency()).toUpperCase();
  const isoDate = effectiveDate ?? new Date().toISOString().slice(0, 10);
  const isDefault = !clientId && !projectName;

  return withTransaction(async (client) => {
    if (isDefault) {
      await client.query('UPDATE billing_rate_cards SET is_default = false WHERE user_id = $1', [userId]);
    }

    const result = await client.query<RateCardRow>(
      `INSERT INTO billing_rate_cards (
        user_id, client_id, project_name, hourly_rate, currency, effective_date, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [userId, clientId, projectName, hourlyRate, normalizedCurrency, isoDate, isDefault]
    );

    const created = mapRateCard(result.rows[0]);
    await recordEvent(client, {
      userId,
      eventType: 'rate_card_created',
      entityType: 'billing_rate_card',
      entityId: created.id,
      eventData: {
        clientId,
        projectName,
        hourlyRate,
        currency: normalizedCurrency,
        effectiveDate: isoDate,
        isDefault
      }
    });

    return created;
  });
}

export interface ListRateCardsResult {
  rateCards: RateCardResult[];
  defaultRate: number | null;
}

export async function listRateCards(params: { userId: string; clientId?: string | null }): Promise<ListRateCardsResult> {
  const { userId, clientId = null } = params;

  const result = await withTransaction(async (client) => {
    const rateCards = await client.query<RateCardRow>(
      `SELECT *
         FROM billing_rate_cards
        WHERE user_id = $1
          AND ($2::text IS NULL OR client_id = $2 OR client_id IS NULL)
        ORDER BY effective_date DESC, created_at DESC`,
      [userId, clientId]
    );

    const defaultRow = await client.query<{ hourly_rate: string }>(
      `SELECT hourly_rate
         FROM billing_rate_cards
        WHERE user_id = $1 AND is_default = true
        ORDER BY effective_date DESC
        LIMIT 1`,
      [userId]
    );

    const defaultRate =
      defaultRow.rows.length > 0
        ? Number(defaultRow.rows[0].hourly_rate)
        : await deriveFallbackDefaultRate(client);

    return {
      rateCards: rateCards.rows.map(mapRateCard),
      defaultRate
    };
  });

  return result;
}

async function deriveFallbackDefaultRate(client: pg.PoolClient): Promise<number | null> {
  const fallback = getDefaultHourlyRate();
  if (fallback > 0) {
    return fallback;
  }

  const sampledEntry = await client.query<{ hourly_rate: string | null }>(
    `SELECT hourly_rate
       FROM time_entries
      WHERE hourly_rate IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`
  );

  if (sampledEntry.rows.length > 0 && sampledEntry.rows[0].hourly_rate !== null) {
    return Number(sampledEntry.rows[0].hourly_rate);
  }

  return null;
}

export interface EffectiveRate {
  hourlyRate: number;
  currency: string;
  source: 'project' | 'client' | 'default' | 'fallback';
}

export async function resolveEffectiveRate(params: {
  client: pg.PoolClient;
  userId: string;
  clientId: string;
  projectName: string;
}): Promise<EffectiveRate> {
  const { client, userId, clientId, projectName } = params;
  const queryResult = await client.query<RateCardRow>(
    `SELECT *,
            CASE
              WHEN project_name = $3 AND client_id = $2 THEN 1
              WHEN project_name = $3 AND client_id IS NULL THEN 2
              WHEN project_name IS NULL AND client_id = $2 THEN 3
              WHEN is_default = true THEN 4
              ELSE 5
            END AS priority
       FROM billing_rate_cards
      WHERE user_id = $1
        AND (
          (project_name = $3 AND ($2::text IS NULL OR client_id = $2))
          OR (project_name IS NULL AND client_id = $2)
          OR is_default = true
        )
      ORDER BY priority ASC, effective_date DESC
      LIMIT 1`,
    [userId, clientId, projectName]
  );

  if (queryResult.rows.length > 0) {
    const row = queryResult.rows[0];
    let source: EffectiveRate['source'] = 'default';
    if (row.project_name === projectName && row.client_id === clientId) {
      source = 'project';
    } else if (row.project_name === projectName) {
      source = 'project';
    } else if (row.client_id === clientId) {
      source = 'client';
    }

    return {
      hourlyRate: Number(row.hourly_rate),
      currency: row.currency,
      source
    };
  }

  const fallbackRate = getDefaultHourlyRate();
  if (fallbackRate > 0) {
    return {
      hourlyRate: fallbackRate,
      currency: getDefaultCurrency(),
      source: 'fallback'
    };
  }

  return {
    hourlyRate: 0,
    currency: getDefaultCurrency(),
    source: 'fallback'
  };
}
