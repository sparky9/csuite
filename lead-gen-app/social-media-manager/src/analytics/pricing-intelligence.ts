import crypto from 'crypto';
import type { PricingModel } from '../types/social.types.js';

type CurrencyCode = 'USD' | 'CAD' | 'GBP' | 'EUR' | string;

export interface ServicePricingSnapshot {
  serviceName: string;
  priceLow: number;
  priceHigh: number;
  pricingModel: PricingModel;
  currency: CurrencyCode;
  lastChecked: string;
  pricingId?: string;
}

const DEFAULT_SERVICES = [
  'Social Media Strategy Intensive',
  'Monthly Content Management',
  'Paid Campaign Management',
];

const MODEL_WEIGHTING: Array<{ includes: RegExp; model: PricingModel }> = [
  { includes: /hour|consult/i, model: 'hourly' },
  { includes: /retainer|management|monthly/i, model: 'retainer' },
  { includes: /subscription|plan|package/i, model: 'subscription' },
];

const PRICING_MODELS: PricingModel[] = ['fixed', 'hourly', 'subscription', 'retainer'];

function seededNumber(seed: string, min: number, max: number): number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const slice = hash.slice(0, 12);
  const intValue = parseInt(slice, 16);
  const ratio = intValue / 0xffffffffffff;
  return min + ratio * (max - min);
}

function roundToIncrement(value: number, increment = 25): number {
  return Math.round(value / increment) * increment;
}

function determinePricingModel(serviceName: string, seed: string): PricingModel {
  const weighted = MODEL_WEIGHTING.find(({ includes }) => includes.test(serviceName));
  if (weighted) {
    return weighted.model;
  }

  const idx = Math.floor(seededNumber(seed, 0, PRICING_MODELS.length));
  return PRICING_MODELS[idx % PRICING_MODELS.length];
}

function determineBaseRange(serviceName: string, competitorName: string): { low: number; high: number } {
  const normalized = serviceName.toLowerCase();
  let min = 350;
  let max = 2500;

  if (normalized.includes('audit') || normalized.includes('setup')) {
    max = 1200;
  }

  if (normalized.includes('coaching') || normalized.includes('consult')) {
    min = 150;
    max = 600;
  }

  if (normalized.includes('campaign') || normalized.includes('ads')) {
    min = 500;
    max = 3200;
  }

  if (normalized.includes('management')) {
    min = 650;
    max = 4000;
  }

  if (normalized.includes('retainer')) {
    min = 900;
    max = 5000;
  }

  const base = seededNumber(`${competitorName}:${serviceName}`, min, max);
  const low = roundToIncrement(base * 0.85, 25);
  const high = Math.max(low + 100, roundToIncrement(base * 1.2, 25));

  return { low, high };
}

export function selectDefaultServices(seed: string): string[] {
  const services = [...DEFAULT_SERVICES];
  if (seededNumber(`${seed}:extra`, 0, 1) > 0.6) {
    services.push('Content Repurposing Package');
  }
  if (seededNumber(`${seed}:ads`, 0, 1) > 0.7) {
    services.push('Paid Ads Optimization');
  }
  return services;
}

export function generatePricingSnapshot(
  competitorName: string,
  serviceName: string,
  currency: CurrencyCode = 'USD',
): ServicePricingSnapshot {
  const range = determineBaseRange(serviceName, competitorName);
  const model = determinePricingModel(serviceName, `${competitorName}:${serviceName}:model`);

  return {
    serviceName,
    priceLow: range.low,
    priceHigh: range.high,
    pricingModel: model,
    currency,
    lastChecked: new Date().toISOString(),
  };
}

export function deriveDeterministicId(userId: string, competitorName: string): string {
  const seed = `${userId}:${competitorName}`;
  const hash = crypto.createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function formatCurrency(value: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toFixed(0)}`;
  }
}

export function formatPriceRange(low: number, high: number, currency: CurrencyCode): string {
  return `${formatCurrency(low, currency)}-${formatCurrency(high, currency)}`;
}

export function calculateChangePercent(oldAverage: number, newAverage: number): number {
  if (oldAverage === 0) {
    return 0;
  }
  const change = ((newAverage - oldAverage) / oldAverage) * 100;
  return Math.round(change * 100) / 100;
}

export function determinePositionRecommendation(
  yourPrice: number,
  marketAverage: number,
): { position: 'below_average' | 'competitive' | 'above_average'; recommendation: string } {
  const diff = yourPrice - marketAverage;
  const percentDiff = marketAverage === 0 ? 0 : Math.round((diff / marketAverage) * 1000) / 10;

  if (marketAverage === 0) {
    return {
      position: 'competitive',
      recommendation: 'Not enough competitor data yet—use stored rates to build a baseline.',
    };
  }

  if (percentDiff <= -10) {
    return {
      position: 'below_average',
      recommendation: `You're priced ${Math.abs(percentDiff)}% below market average. Consider nudging rates up to stay aligned with competitors while preserving your value advantage.`,
    };
  }

  if (percentDiff >= 12) {
    return {
      position: 'above_average',
      recommendation: `You're priced ${percentDiff}% above market average. Strengthen positioning or value-adds to justify premium pricing.`,
    };
  }

  return {
    position: 'competitive',
    recommendation: 'Your pricing sits within competitive range. Keep highlighting outcomes and differentiation to maintain positioning.',
  };
}
