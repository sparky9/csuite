export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const toISODate = (date: Date): string => date.toISOString().slice(0, 10);
