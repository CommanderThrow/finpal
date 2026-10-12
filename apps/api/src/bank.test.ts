import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { isAllowedRedirect } from './bank';
import { Sealer } from './crypto';
import { loadEnv } from './env';
import { buildServer } from './server';
import { FakeFinverse, MemoryStore, TEST_KEY } from './testing/fakes';

const env = loadEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' });
const sealer = new Sealer(TEST_KEY);
const finverse = new FakeFinverse();
const store = new MemoryStore();
const appRedirects = ['http://localhost:8081/linked', 'exp://*'];
const app = await buildServer(env, async (t) => (t === 'good' ? { userId: 'user-1' } : null), {
  finverse,
  store,
  sealer,
  appRedirects,
});
const auth = { authorization: 'Bearer good' };

afterAll(() => app.close());
beforeEach(() => {
  finverse.failExchange = false;
  store.connections = [];
});

async function linkState(returnTo = 'http://localhost:8081/linked') {
  const res = await app.inject({ method: 'POST', url: '/link/token', headers: auth, payload: { returnTo } });
  expect(res.statusCode).toBe(200);
  return new URL(res.json().linkUrl).searchParams.get('state')!;
}

describe('isAllowedRedirect', () => {
  it('matches exact entries and * prefixes only', () => {
    expect(isAllowedRedirect('http://localhost:8081/linked', appRedirects)).toBe(true);
    expect(isAllowedRedirect('exp://192.168.1.5:8081/--/linked', appRedirects)).toBe(true);
    expect(isAllowedRedirect('https://evil.example/linked', appRedirects)).toBe(false);
    expect(isAllowedRedirect('http://localhost:8081/linked/../x', appRedirects)).toBe(false);
  });
});

describe('POST /link/token', () => {
  it('requires sign-in', async () => {
    const res = await app.inject({ method: 'POST', url: '/link/token', payload: { returnTo: appRedirects[0] } });
    expect(res.statusCode).toBe(401);
  });

  it('refuses a returnTo outside the allow list', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/link/token',
      headers: auth,
      payload: { returnTo: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns a Finverse Link URL carrying signed state', async () => {
    const state = await linkState();
    expect(sealer.verify<{ userId: string }>(state)?.userId).toBe('user-1');
  });
});

describe('/link/callback', () => {
  it('exchanges the code, saves the connection and sends the user back', async () => {
    const state = await linkState();
    const res = await app.inject({
      method: 'POST',
      url: '/link/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ code: 'abc', state }).toString(),
    });
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('http://localhost:8081/linked?status=ok');
    expect(store.connections.map((c) => c.userId)).toEqual(['user-1']);
  });

  it('accepts the query-string form too', async () => {
    const state = await linkState('exp://10.0.0.2:8081/--/linked');
    const res = await app.inject({ method: 'GET', url: `/link/callback?code=abc&state=${encodeURIComponent(state)}` });
    expect(res.headers.location).toBe('exp://10.0.0.2:8081/--/linked?status=ok');
  });

  it('sends the user back with an error when Link reports one', async () => {
    const state = await linkState();
    const res = await app.inject({ method: 'GET', url: `/link/callback?error=access_denied&state=${state}` });
    expect(res.headers.location).toBe('http://localhost:8081/linked?status=error');
    expect(store.connections).toHaveLength(0);
  });

  it('sends the user back with an error when the exchange fails', async () => {
    finverse.failExchange = true;
    const state = await linkState();
    const res = await app.inject({ method: 'GET', url: `/link/callback?code=abc&state=${state}` });
    expect(res.headers.location).toBe('http://localhost:8081/linked?status=error');
  });

  it('rejects forged or missing state', async () => {
    const before = finverse.calls.length;
    const forged = await app.inject({ method: 'GET', url: '/link/callback?code=abc&state=nope.nope' });
    const missing = await app.inject({ method: 'GET', url: '/link/callback?code=abc' });
    expect(forged.statusCode).toBe(400);
    expect(missing.statusCode).toBe(400);
    expect(finverse.calls.length).toBe(before);
  });
});

describe('data routes', () => {
  it('syncs and lists transactions for the signed-in user', async () => {
    const state = await linkState();
    await app.inject({ method: 'GET', url: `/link/callback?code=abc&state=${state}` });

    const sync = await app.inject({ method: 'POST', url: '/sync', headers: auth });
    expect(sync.json()).toEqual({ status: 'ready', accounts: 1, transactions: 1 });

    const list = await app.inject({ method: 'GET', url: '/transactions?limit=10', headers: auth });
    expect(list.json().transactions[0].id).toBe('tx-1');
  });
});
