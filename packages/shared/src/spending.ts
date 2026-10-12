import type { Transaction } from './types';

export const UNCATEGORISED = 'Uncategorised';

/** Categories offered when re-categorising, alongside any Finverse already uses. */
export const DEFAULT_CATEGORIES = [
  'Groceries',
  'Food and drink',
  'Transport',
  'Bills and utilities',
  'Rent and housing',
  'Shopping',
  'Health',
  'Entertainment',
  'Travel',
  'Education',
  'Transfers',
  'Income',
  UNCATEGORISED,
];

/** Money moving between your own accounts, or coming in, is not spending. */
export const NON_SPENDING_CATEGORIES = new Set(['Transfers', 'Income']);

/** "2026-10-03" → "2026-10". */
export const monthOf = (date: string) => date.slice(0, 7);

/** The month `offset` months from `month` ("2026-01", -1 → "2025-12"). */
export function addMonths(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** First and last day of a month, as YYYY-MM-DD. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export interface CategorySpending {
  category: string;
  /** Money out this month, as a positive number. */
  thisMonth: number;
  /** Average monthly money out over the previous months, as a positive number. */
  average: number;
}

export interface MonthlySpending {
  month: string;
  /** How many earlier months the averages cover. */
  averageMonths: number;
  total: number;
  averageTotal: number;
  categories: CategorySpending[];
}

/**
 * Money out per category for `month`, next to the average of the `averageMonths`
 * months before it. Money in (positive amounts) and NON_SPENDING_CATEGORIES are ignored.
 */
export function monthlySpending(
  transactions: Transaction[],
  month: string,
  averageMonths = 3,
): MonthlySpending {
  const earlier = new Set(Array.from({ length: averageMonths }, (_, i) => addMonths(month, -(i + 1))));
  const current = new Map<string, number>();
  const past = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const m = monthOf(t.postedDate);
    const bucket = m === month ? current : earlier.has(m) ? past : null;
    if (!bucket) continue;
    const category = t.category || UNCATEGORISED;
    if (NON_SPENDING_CATEGORIES.has(category)) continue;
    bucket.set(category, (bucket.get(category) ?? 0) + -t.amount);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const categories = [...new Set([...current.keys(), ...past.keys()])]
    .map((category) => ({
      category,
      thisMonth: round(current.get(category) ?? 0),
      average: round((past.get(category) ?? 0) / averageMonths),
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth || b.average - a.average);

  return {
    month,
    averageMonths,
    total: round(categories.reduce((s, c) => s + c.thisMonth, 0)),
    averageTotal: round(categories.reduce((s, c) => s + c.average, 0)),
    categories,
  };
}
