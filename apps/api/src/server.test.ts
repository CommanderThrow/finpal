import { afterAll, describe, expect, it } from 'vitest';

import { loadEnv } from './env';
import { buildServer } from './server';

const env = loadEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' });
const app = await buildServer(env, async (token) => (token === 'good' ? { userId: 'user-1' } : null));

afterAll(() => app.close());

describe('api', () => {
  it('answers health checks without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, bankLinking: false });
  });

  it('rejects /me without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects /me with a bad token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer bad' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns the user for a valid token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer good' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: 'user-1' });
  });
});

describe('without Finverse settings', () => {
  it('answers bank routes with 503', async () => {
    const res = await app.inject({ method: 'POST', url: '/sync', headers: { authorization: 'Bearer good' } });
    expect(res.statusCode).toBe(503);
  });
});
