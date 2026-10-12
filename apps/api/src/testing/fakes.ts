import type { Account, Transaction } from '@finpal/shared';

import type { BankTokens, FinverseClient } from '../finverse';
import type { Connection, Store } from '../store';

export const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

export function tokens(overrides: Partial<BankTokens> = {}): BankTokens {
  return {
    loginIdentityId: 'li-1',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + 3600_000),
    ...overrides,
  };
}

export const account: Account = {
  id: 'acc-1',
  name: 'Savings',
  type: 'SAVINGS',
  currency: 'MYR',
  balance: 1500,
  maskedNumber: '****1234',
};

export const transaction: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  postedDate: '2026-10-01',
  amount: -42.5,
  currency: 'MYR',
  description: 'GRAB FOOD',
  merchantName: 'Grab',
  category: 'Food',
  isPending: false,
};

export class FakeFinverse implements FinverseClient {
  status = 'DATA_RETRIEVAL_COMPLETE';
  calls: string[] = [];
  failExchange = false;

  async createLinkUrl({ state }: { userId: string; state: string }) {
    this.calls.push('createLinkUrl');
    return `https://link.sandbox.finverse.net/?state=${state}`;
  }
  async exchangeCode(code: string) {
    this.calls.push(`exchangeCode:${code}`);
    if (this.failExchange) throw new Error('bad code');
    return tokens();
  }
  async refreshTokens(refreshToken: string) {
    this.calls.push(`refreshTokens:${refreshToken}`);
    return tokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  }
  async getStatus(accessToken: string) {
    this.calls.push(`getStatus:${accessToken}`);
    return this.status;
  }
  async listAccounts() {
    return [account];
  }
  async listTransactions() {
    return [transaction];
  }
}

export class MemoryStore implements Store {
  connections: Connection[] = [];
  accounts: Account[] = [];
  transactions: Transaction[] = [];

  async saveConnection(userId: string, t: BankTokens) {
    this.connections = this.connections.filter((c) => c.loginIdentityId !== t.loginIdentityId);
    this.connections.push({ ...t, id: `conn-${this.connections.length + 1}`, userId, status: 'LINKING' });
  }
  async listConnections(userId: string) {
    return this.connections.filter((c) => c.userId === userId);
  }
  async updateConnection(id: string, patch: { tokens?: BankTokens; status?: string }) {
    const c = this.connections.find((x) => x.id === id);
    if (!c) throw new Error(`no connection ${id}`);
    Object.assign(c, patch.tokens ?? {}, patch.status ? { status: patch.status } : {});
  }
  async saveAccounts(_userId: string, _connectionId: string, accounts: Account[]) {
    this.accounts.push(...accounts);
  }
  async saveTransactions(_userId: string, transactions: Transaction[]) {
    this.transactions.push(...transactions);
  }
  async listAccounts() {
    return this.accounts;
  }
  async listTransactions() {
    return this.transactions;
  }
}
