export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
