import { describe, expect, it } from 'vitest';
import { roundCurrency, toNumber } from '../utils/currency.js';

describe('currency utilities', () => {
  it('rounds to two decimal places', () => {
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(roundCurrency(10.004)).toBe(10);
    expect(roundCurrency(-3.336)).toBe(-3.34);
  });

  it('converts various inputs to numbers safely', () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber('12.34')).toBe(12.34);
    expect(toNumber('not-a-number')).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});
