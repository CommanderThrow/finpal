/** Finpal budgets in Malaysian ringgit; Finverse amounts are decimal values, not minor units. */
export const DEFAULT_CURRENCY = 'MYR';

const SYMBOLS: Record<string, string> = { MYR: 'RM' };

/**
 * Formats an amount as "RM 1,234.50". Done by hand rather than with Intl because
 * Hermes, browsers and Node ship different ICU data and disagree on the output.
 */
export function formatMoney(value: number, currency: string = DEFAULT_CURRENCY): string {
  const symbol = SYMBOLS[currency] ?? currency;
  const [whole, cents] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${symbol} ${grouped}.${cents}`;
}
