/**
 * Currency utilities to support multi-currency bookkeeping workflows.
 * Provides helpers for normalizing currency codes and computing base-currency values.
 */
export const BASE_CURRENCY = 'USD';
const FALLBACK_RATES = {
    USD: 1,
    CAD: 0.74,
    EUR: 1.07,
    GBP: 1.25,
    AUD: 0.66,
    NZD: 0.61,
    JPY: 0.0067,
    CHF: 1.12,
    SGD: 0.74,
    MXN: 0.059,
    INR: 0.012,
    CNY: 0.14,
};
function sanitizeCurrency(code) {
    if (!code || typeof code !== 'string') {
        return undefined;
    }
    const trimmed = code.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.toUpperCase();
}
export function normalizeCurrency(code) {
    return sanitizeCurrency(code) ?? BASE_CURRENCY;
}
export function normalizeExchangeRate(currency, exchangeRate) {
    if (!currency || currency === BASE_CURRENCY) {
        return 1;
    }
    if (typeof exchangeRate === 'number' && Number.isFinite(exchangeRate) && exchangeRate > 0) {
        return Number(exchangeRate.toFixed(6));
    }
    return FALLBACK_RATES[currency] ?? 1;
}
export function toBaseCurrency(amount, currency, exchangeRate) {
    const normalizedCurrency = normalizeCurrency(currency);
    const rate = normalizeExchangeRate(normalizedCurrency, exchangeRate);
    return Number((amount * rate).toFixed(2));
}
export function getFallbackExchangeRate(currency) {
    const normalized = normalizeCurrency(currency);
    return normalized === BASE_CURRENCY ? 1 : FALLBACK_RATES[normalized];
}
export function describeExchangeRate(currency, exchangeRate) {
    const normalizedCurrency = normalizeCurrency(currency);
    const normalizedRate = normalizeExchangeRate(normalizedCurrency, exchangeRate);
    return {
        currency: normalizedCurrency,
        exchangeRate: normalizedRate,
        baseCurrency: BASE_CURRENCY,
    };
}
