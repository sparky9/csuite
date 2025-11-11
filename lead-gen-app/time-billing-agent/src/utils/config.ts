import process from 'node:process';

export function resolveUserId(provided?: string | null): string {
  const normalized = (provided ?? process.env.TIME_BILLING_DEFAULT_USER_ID ?? '').trim();
  if (!normalized) {
    throw new Error('userId is required. Configure TIME_BILLING_DEFAULT_USER_ID or pass userId explicitly.');
  }
  return normalized;
}

export function getDefaultCurrency(): string {
  const currency = process.env.BILLING_DEFAULT_CURRENCY?.trim();
  return currency && currency.length >= 3 ? currency.toUpperCase() : 'USD';
}

export function getDefaultNetTerms(): number {
  const value = Number(process.env.BILLING_DEFAULT_NET_TERMS);
  if (Number.isFinite(value) && value > 0 && value <= 90) {
    return Math.trunc(value);
  }
  return 30;
}

export function getDefaultHourlyRate(): number {
  const value = Number(process.env.TIME_BILLING_DEFAULT_RATE);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }
  return 0;
}
