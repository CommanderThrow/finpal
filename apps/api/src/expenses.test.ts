import type { Transaction } from '@finpal/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { Sealer } from './crypto';
import { loadEnv } from './env';
import { buildServer } from './server';
import { FakeFinverse, MemoryStore, TEST_KEY } from './testing/fakes';

const env = loadEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' });
const store = new MemoryStore();
const app = await buildServer(env, async (t) => (t === 'good' ? { userId: 'user-1' } : null), {
  finverse: new FakeFinverse(),
  store,
  sealer: new Sealer(TEST_KEY),
  appRedirects: [],
});
const auth = { authorization: 'Bearer good' };

const tx = (id: string, postedDate: string, amount: number, merchantName: string, category: string | null) =>
  ({ id, accountId: 'a1', postedDate, amount, currency: 'MYR', description: merchantName.toUpperCase(), merchantName, category, isPending: false }) satisfies Transaction;

afterAll(() => app.close());
beforeEach(() => {
  store.rules.clear();
  store.transactions = [
    tx('t1', '2026-10-02', -25, 'Grab', 'Transport'),
    tx('t2', '2026-10-05', -80, 'Jaya Grocer', null),
    tx('t3', '2026-09-20', -60, 'Jaya Grocer', 'Groceries'),
    tx('t4', '2026-10-06', -12, 'Grab', 'Transport'),
  ];
});

describe('GET /transactions filters', () => {
  it('searches merchant and description', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions?search=jaya', headers: auth });
    expect(res.json().transactions.map((t: Transaction) => t.id)).toEqual(['t2', 't3']);
  });

  it('filters by category, including uncategorised', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions?category=Uncategorised', headers: auth });
    expect(res.json().transactions.map((t: Transaction) => t.id)).toEqual(['t2']);
  });

  it('filters by date range', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions?from=2026-10-01&to=2026-10-31', headers: auth });
    expect(res.json().transactions).toHaveLength(3);
  });

  it('rejects malformed dates', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions?from=yesterday', headers: auth });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /transactions/:id', () => {
  it('re-categorises one transaction', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/t2',
      headers: auth,
      payload: { category: 'Groceries' },
    });
    expect(res.json().transaction.category).toBe('Groceries');
    expect(store.rules.size).toBe(0);
  });

  it('can file every transaction from the merchant under the category', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/transactions/t1',
      headers: auth,
      payload: { category: 'Food and drink', applyToMerchant: true },
    });
    expect(store.rules.get('Grab')).toBe('Food and drink');
    expect(store.transactions.find((t) => t.id === 't4')?.category).toBe('Food and drink');
  });

  it('404s for an unknown transaction and 400s without a category', async () => {
    const missing = await app.inject({ method: 'PATCH', url: '/transactions/nope', headers: auth, payload: { category: 'X' } });
    const empty = await app.inject({ method: 'PATCH', url: '/transactions/t1', headers: auth, payload: { category: ' ' } });
    expect(missing.statusCode).toBe(404);
    expect(empty.statusCode).toBe(400);
  });
});

describe('GET /spending', () => {
  it('returns this month by category against the earlier average', async () => {
    const res = await app.inject({ method: 'GET', url: '/spending?month=2026-10', headers: auth });
    const body = res.json();
    expect(body.total).toBe(117);
    expect(body.categories).toEqual([
      { category: 'Uncategorised', thisMonth: 80, average: 0 },
      { category: 'Transport', thisMonth: 37, average: 0 },
      { category: 'Groceries', thisMonth: 0, average: 20 },
    ]);
  });

  it('requires a valid month', async () => {
    const res = await app.inject({ method: 'GET', url: '/spending?month=2026-13', headers: auth });
    expect(res.statusCode).toBe(400);
  });
});
