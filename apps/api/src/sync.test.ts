import { describe, expect, it } from 'vitest';

import { syncUser } from './sync';
import { FakeFinverse, MemoryStore, tokens } from './testing/fakes';

describe('syncUser', () => {
  it('reports none when the user has no bank connections', async () => {
    expect(await syncUser('u1', new FakeFinverse(), new MemoryStore())).toEqual({
      status: 'none',
      accounts: 0,
      transactions: 0,
    });
  });

  it('waits while Finverse is still retrieving data', async () => {
    const finverse = new FakeFinverse();
    finverse.status = 'DATA_RETRIEVAL_IN_PROGRESS';
    const store = new MemoryStore();
    await store.saveConnection('u1', tokens());

    const result = await syncUser('u1', finverse, store);

    expect(result.status).toBe('pending');
    expect(store.transactions).toHaveLength(0);
    expect(store.connections[0].status).toBe('DATA_RETRIEVAL_IN_PROGRESS');
  });

  it('saves accounts and transactions once data is ready', async () => {
    const store = new MemoryStore();
    await store.saveConnection('u1', tokens());

    const result = await syncUser('u1', new FakeFinverse(), store);

    expect(result).toEqual({ status: 'ready', accounts: 1, transactions: 1 });
    expect(store.accounts.map((a) => a.id)).toEqual(['acc-1']);
    expect(store.transactions.map((t) => t.id)).toEqual(['tx-1']);
  });

  it('refreshes an expiring token before using it', async () => {
    const finverse = new FakeFinverse();
    const store = new MemoryStore();
    await store.saveConnection('u1', tokens({ expiresAt: new Date(Date.now() + 10_000) }));

    await syncUser('u1', finverse, store);

    expect(finverse.calls).toContain('refreshTokens:refresh-1');
    expect(finverse.calls).toContain('getStatus:access-2');
    expect(store.connections[0].refreshToken).toBe('refresh-2');
  });

  it('reports an error when the bank connection failed', async () => {
    const finverse = new FakeFinverse();
    finverse.status = 'ERROR';
    const store = new MemoryStore();
    await store.saveConnection('u1', tokens());

    expect((await syncUser('u1', finverse, store)).status).toBe('error');
  });
});
