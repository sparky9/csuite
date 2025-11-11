/**
 * MCP Tool: Monitor Competitor Pricing
 * Track competitor rates and highlight pricing changes.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { socialDb } from '../db/client.js';
import { logger, logToolExecution } from '../utils/logger.js';
import {
  calculateChangePercent,
  deriveDeterministicId,
  formatPriceRange,
  generatePricingSnapshot,
  selectDefaultServices,
  type ServicePricingSnapshot,
} from '../analytics/pricing-intelligence.js';

interface PricingRow {
  id: string;
  price_low: string | number | null;
  price_high: string | number | null;
  last_checked: Date | string | null;
  pricing_model: string | null;
  currency: string | null;
}

const MonitorCompetitorPricingSchema = z.object({
  user_id: z.string().min(2, 'user_id is required'),
  competitor_name: z.string().min(2, 'competitor_name must have at least 2 characters'),
  competitor_website: z.string().min(4, 'competitor_website is required'),
  services_to_track: z.array(z.string().min(2)).optional(),
});

type MonitorCompetitorPricingInput = z.infer<typeof MonitorCompetitorPricingSchema>;

interface PriceChangeSummary {
  service: string;
  oldPrice: string;
  newPrice: string;
  changeDate: string;
  changePercent: number;
}

function normaliseServiceName(service: string): string {
  return service.trim();
}

async function persistPricingSnapshots(
  userId: string,
  competitorName: string,
  competitorWebsite: string,
  snapshots: ServicePricingSnapshot[],
): Promise<{ competitorId: string; changes: PriceChangeSummary[] }> {
  if (!socialDb.connected) {
    const competitorId = deriveDeterministicId(userId, competitorName);
    return { competitorId, changes: [] };
  }

  const changes: PriceChangeSummary[] = [];
  let competitorId: string | null = null;

  for (const snapshot of snapshots) {
    const normalizedService = normaliseServiceName(snapshot.serviceName);
    const existing = await socialDb.queryOne<PricingRow>(
      `SELECT id, price_low, price_high, last_checked, pricing_model, currency
       FROM social_competitor_pricing
       WHERE user_id = $1 AND competitor_name = $2 AND service_name = $3`,
      [userId, competitorName, normalizedService],
    );

    const result = await socialDb.query<PricingRow>(
      `INSERT INTO social_competitor_pricing (
        user_id, competitor_name, competitor_website, service_name,
        price_low, price_high, pricing_model, currency, last_checked, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (user_id, competitor_name, service_name)
      DO UPDATE SET
        competitor_website = EXCLUDED.competitor_website,
        price_low = EXCLUDED.price_low,
        price_high = EXCLUDED.price_high,
        pricing_model = EXCLUDED.pricing_model,
        currency = EXCLUDED.currency,
        last_checked = NOW(),
        updated_at = NOW()
      RETURNING id, price_low, price_high, last_checked, pricing_model, currency`,
      [
        userId,
        competitorName,
        competitorWebsite,
        normalizedService,
        snapshot.priceLow,
        snapshot.priceHigh,
        snapshot.pricingModel,
        snapshot.currency,
      ],
    );

    const stored = result.rows[0];
    snapshot.pricingId = stored.id;
    const storedLastChecked = stored.last_checked instanceof Date
      ? stored.last_checked.toISOString()
      : stored.last_checked
        ? new Date(stored.last_checked).toISOString()
        : snapshot.lastChecked;
    snapshot.lastChecked = storedLastChecked;

    competitorId = competitorId ?? stored.id;

    if (existing) {
      const prevLow = Number(existing.price_low ?? 0);
      const prevHigh = Number(existing.price_high ?? 0);
      const newLow = Number(stored.price_low ?? snapshot.priceLow);
      const newHigh = Number(stored.price_high ?? snapshot.priceHigh);

      const prevAverage = (prevLow + prevHigh) / 2;
      const newAverage = (newLow + newHigh) / 2;
      const changePercent = calculateChangePercent(prevAverage, newAverage);

      const hasChanged = Math.abs(newAverage - prevAverage) >= 1;
      if (hasChanged && changePercent !== 0) {
        await socialDb.query(
          `INSERT INTO social_competitor_price_changes (
            pricing_id, user_id, service_name, old_price_low, old_price_high,
            new_price_low, new_price_high, change_percent, change_date, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, NOW())`,
          [
            stored.id,
            userId,
            normalizedService,
            prevLow,
            prevHigh,
            newLow,
            newHigh,
            changePercent,
          ],
        );

        changes.push({
          service: normalizedService,
          oldPrice: formatPriceRange(prevLow, prevHigh, stored.currency ?? snapshot.currency),
          newPrice: formatPriceRange(newLow, newHigh, stored.currency ?? snapshot.currency),
          changeDate: new Date().toISOString().split('T')[0],
          changePercent,
        });
      }
    }
  }

  return {
    competitorId: competitorId ?? deriveDeterministicId(userId, competitorName),
    changes,
  };
}

function buildServicesOutput(snapshots: ServicePricingSnapshot[]) {
  return snapshots.map((snapshot) => ({
    serviceName: snapshot.serviceName,
    priceLow: snapshot.priceLow,
    priceHigh: snapshot.priceHigh,
    priceRange: formatPriceRange(snapshot.priceLow, snapshot.priceHigh, snapshot.currency),
    pricingModel: snapshot.pricingModel,
    currency: snapshot.currency,
    lastChecked: snapshot.lastChecked,
    pricingId: snapshot.pricingId,
  }));
}

export const monitorCompetitorPricingTool: Tool = {
  name: 'monitor_competitor_pricing',
  description: `Track competitor pricing for key services.
Stores deterministic price ranges for each service and records historical changes when rates shift.
Required parameters:
- user_id: User identifier
- competitor_name: Competitor business name
- competitor_website: Link or domain for the competitor
Optional parameters:
- services_to_track: Array of services to capture pricing for
Returns:
- competitorId: Identifier for the tracked competitor/service bundle
- services: Array of service pricing snapshots
- priceChanges: Historical change events recorded during this run`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User identifier (required)' },
      competitor_name: { type: 'string', description: 'Competitor name' },
      competitor_website: { type: 'string', description: 'Competitor website or landing page' },
      services_to_track: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of services to track pricing for',
      },
    },
    required: ['user_id', 'competitor_name', 'competitor_website'],
  },
};

export async function handleMonitorCompetitorPricing(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = MonitorCompetitorPricingSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    if (!effectiveUserId) {
      throw new Error('User ID is required for competitor pricing monitoring.');
    }

    const services = input.services_to_track?.length
      ? input.services_to_track
      : selectDefaultServices(`${input.competitor_name}:${input.competitor_website}`);

    const snapshots: ServicePricingSnapshot[] = services.map((service) =>
      generatePricingSnapshot(input.competitor_name, normaliseServiceName(service)),
    );

    const persistence = await persistPricingSnapshots(
      effectiveUserId,
      input.competitor_name,
      input.competitor_website,
      snapshots,
    );

    const duration = Date.now() - startTime;
    logToolExecution('monitor_competitor_pricing', effectiveUserId, input, true, duration);

    const payload = {
      competitorId: persistence.competitorId,
      competitorName: input.competitor_name,
      competitorWebsite: input.competitor_website,
      services: buildServicesOutput(snapshots),
      priceChanges: persistence.changes,
      metadata: {
        persisted: socialDb.connected,
        serviceCount: snapshots.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, pricing: payload }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('monitor_competitor_pricing failed', {
      error: error.message,
      stack: error.stack,
    });

    const duration = Date.now() - startTime;
    logToolExecution('monitor_competitor_pricing', userId, {}, false, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
