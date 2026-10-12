import { describe, expect, it } from 'vitest';

import { addMonths, monthlySpending, monthRange } from './spending';
import type { Transaction } from './types';

const tx = (postedDate: string, amount: number, category: string | null): Transaction => ({
  id: `${postedDate}-${amount}-${category}`,
  accountId: 'a1',
  postedDate,
  amount,
  currency: 'MYR',
  description: '',
  merchantName: null,
  category,
  isPending: false,
});

describe('month helpers', () => {
  it('steps across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-10', -3)).toBe('2026-07');
  });

  it('knows the last day of each month', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02').to).toBe('2028-02-29');
    expect(monthRange('2026-10').to).toBe('2026-10-31');
  });
});

describe('monthlySpending', () => {
  const data = [
    tx('2026-10-02', -100, 'Groceries'),
    tx('2026-10-15', -50.25, 'Groceries'),
    tx('2026-10-20', -30, null),
    tx('2026-10-25', 5000, 'Income'),
    tx('2026-09-10', -120, 'Groceries'),
    tx('2026-08-10', -90, 'Groceries'),
    tx('2026-07-10', -90, 'Groceries'),
    tx('2026-07-11', -60, 'Transport'),
    tx('2026-06-10', -999, 'Groceries'),
  ];

  it('totals money out per category against the previous three months', () => {
    const result = monthlySpending(data, '2026-10');
    expect(result.categories).toEqual([
      { category: 'Groceries', thisMonth: 150.25, average: 100 },
      { category: 'Uncategorised', thisMonth: 30, average: 0 },
      { category: 'Transport', thisMonth: 0, average: 20 },
    ]);
    expect(result.total).toBe(180.25);
    expect(result.averageTotal).toBe(120);
  });

  it('ignores money in and months outside the window', () => {
    const result = monthlySpending(data, '2026-10', 1);
    expect(result.categories.find((c) => c.category === 'Income')).toBeUndefined();
    expect(result.categories.find((c) => c.category === 'Groceries')?.average).toBe(120);
  });
});
