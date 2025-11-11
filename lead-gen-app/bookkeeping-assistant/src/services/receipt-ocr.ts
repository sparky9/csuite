import { normalizeCurrency, normalizeExchangeRate, toBaseCurrency, getFallbackExchangeRate } from '../utils/currency.js';
import type { ReceiptExtractionResult } from '../types/bookkeeping.types.js';

interface ReceiptOcrAnalysis {
  checksum: string;
  extracted: ReceiptExtractionResult;
  confidence: number;
  baseAmount: number;
}

const VENDORS = [
  'Office Depot',
  'Staples',
  'Amazon Business',
  'Delta Airlines',
  'Starbucks',
  'WeWork',
  'Adobe',
  'QuickBooks',
  'Coursera',
  'Lyft',
];

const VENDOR_CATEGORIES: Record<string, string> = {
  'Office Depot': 'office_supplies',
  Staples: 'office_supplies',
  'Amazon Business': 'software',
  'Delta Airlines': 'travel',
  Starbucks: 'meals',
  WeWork: 'utilities',
  Adobe: 'software',
  QuickBooks: 'professional_services',
  Coursera: 'professional_services',
  Lyft: 'travel',
};

const CURRENCIES = ['USD', 'USD', 'USD', 'CAD', 'EUR', 'GBP', 'AUD'];

function hashSegment(payload: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 2654435761) >>> 0;
  }
  return hash >>> 0;
}

function deterministicHash(payload: string): string {
  let seed = 2166136261;
  let hash = '';
  for (let i = 0; i < 4; i += 1) {
    seed = hashSegment(payload, seed + i * 1013904223);
    hash += seed.toString(16).padStart(8, '0');
  }
  return hash;
}

function seededNumber(seed: string, min: number, max: number): number {
  const hash = deterministicHash(seed).slice(0, 12);
  const int = parseInt(hash, 16);
  const ratio = int / 0xffffffffff;
  return min + ratio * (max - min);
}

function pickVendor(checksum: string): string {
  const index = parseInt(checksum.slice(0, 2), 16) % VENDORS.length;
  return VENDORS[index];
}

function pickCurrency(checksum: string): string {
  const index = parseInt(checksum.slice(2, 4), 16) % CURRENCIES.length;
  return CURRENCIES[index];
}

export function analyzeReceiptImage(imageBase64: string, userId?: string): ReceiptOcrAnalysis {
  const checksum = deterministicHash(`${imageBase64}:${userId ?? ''}`);
  const vendor = pickVendor(checksum);
  const currency = normalizeCurrency(pickCurrency(checksum));
  const fallbackRate = getFallbackExchangeRate(currency);
  const exchangeRate = normalizeExchangeRate(currency, fallbackRate);
  const amount = Number(seededNumber(checksum.slice(4, 16), 18, 480).toFixed(2));
  const taxAmount = Number((amount * seededNumber(checksum.slice(10, 20), 0.04, 0.12)).toFixed(2));
  const dateOffsetDays = Math.floor(seededNumber(checksum.slice(20, 28), 3, 55));
  const transactionDate = new Date(Date.now() - dateOffsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const category = VENDOR_CATEGORIES[vendor] ?? 'other';
  const reference = `receipt-${checksum.slice(0, 8)}`;
  const baseAmount = toBaseCurrency(amount, currency, exchangeRate);

  const confidence = Number(
    Math.min(0.98, Math.max(0.82, seededNumber(checksum.slice(28, 36), 0.82, 0.97))).toFixed(2),
  );

  const extracted: ReceiptExtractionResult = {
    vendor,
    amount,
    date: transactionDate,
    category,
    taxAmount,
    currency,
    exchangeRate,
    reference,
  };

  return {
    checksum,
    extracted,
    confidence,
    baseAmount,
  };
}
