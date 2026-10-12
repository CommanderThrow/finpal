import { describe, expect, it } from 'vitest';

import { toAccount, toTransaction } from './finverse';

describe('Finverse mapping', () => {
  it('maps an account, preferring the nickname', () => {
    expect(
      toAccount({
        account_id: 'a1',
        group_id: 'g1',
        account_name: 'Basic Savings',
        account_nickname: 'Rainy day',
        account_currency: 'MYR',
        balance: { value: 1200.5, currency: 'MYR' },
        account_number_masked: '****9876',
        account_type: { type: 'DEPOSIT' as never },
        is_parent: false,
        is_closed: false,
        is_excluded: false,
        metadata: {},
      }),
    ).toEqual({
      id: 'a1',
      name: 'Rainy day',
      type: 'DEPOSIT',
      currency: 'MYR',
      balance: 1200.5,
      maskedNumber: '****9876',
    });
  });

  it('maps a transaction and falls back to the transaction time for its date', () => {
    expect(
      toTransaction({
        transaction_id: 't1',
        account_id: 'a1',
        is_pending: true,
        transaction_time: '2026-10-03T09:15:00Z',
        amount: { value: -18.9 },
        description: 'TNG EWALLET',
      }),
    ).toEqual({
      id: 't1',
      accountId: 'a1',
      postedDate: '2026-10-03',
      amount: -18.9,
      currency: 'MYR',
      description: 'TNG EWALLET',
      merchantName: null,
      category: null,
      isPending: true,
    });
  });
});
