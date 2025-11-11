const MS_PER_DAY = 86_400_000;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

export function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  if (input instanceof Date) {
    return input;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
