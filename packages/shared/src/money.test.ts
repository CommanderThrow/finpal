import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats ringgit with the RM symbol and two decimals', () => {
    expect(formatMoney(1234.5)).toBe('RM 1,234.50');
  });

  it('formats negative amounts', () => {
    expect(formatMoney(-20)).toBe('-RM 20.00');
  });
});

describe('formatMoney with other currencies', () => {
  it('falls back to the currency code', () => {
    expect(formatMoney(1000000, 'SGD')).toBe('SGD 1,000,000.00');
  });
});
