import {
  Configuration,
  CustomerApi,
  LinkApi,
  LoginIdentityApi,
  PublicApi,
  TokenGrantTypeEnum,
  type Account as FvAccount,
  type Transaction as FvTransaction,
} from '@finverse/sdk-typescript';
import { DEFAULT_CURRENCY, type Account, type Transaction } from '@finpal/shared';

import type { BankEnv } from './env';

/** A login identity's credentials: one per bank connection. */
export interface BankTokens {
  loginIdentityId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** The parts of Finverse finpal uses; tests swap in a fake. */
export interface FinverseClient {
  createLinkUrl(input: { userId: string; state: string }): Promise<string>;
  exchangeCode(code: string): Promise<BankTokens>;
  refreshTokens(refreshToken: string): Promise<BankTokens>;
  getStatus(accessToken: string): Promise<string>;
  listAccounts(accessToken: string): Promise<Account[]>;
  listTransactions(accessToken: string): Promise<Transaction[]>;
}

const PAGE_SIZE = 500;

export function createFinverseClient(env: BankEnv): FinverseClient {
  const basePath = env.finverseBaseUrl;
  let customerToken: { value: string; expiresAt: number } | null = null;

  async function customerConfig(): Promise<Configuration> {
    if (!customerToken || customerToken.expiresAt - 60_000 < Date.now()) {
      const res = await new PublicApi(new Configuration({ basePath })).generateCustomerAccessToken({
        client_id: env.finverseClientId,
        client_secret: env.finverseClientSecret,
        grant_type: 'client_credentials',
      });
      customerToken = { value: res.data.access_token, expiresAt: Date.now() + res.data.expires_in * 1000 };
    }
    return new Configuration({ basePath, accessToken: customerToken.value });
  }

  const identity = (accessToken: string) => new LoginIdentityApi(new Configuration({ basePath, accessToken }));

  const toTokens = (data: {
    login_identity_id: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }): BankTokens => ({
    loginIdentityId: data.login_identity_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  });

  return {
    async createLinkUrl({ userId, state }) {
      const res = await new LinkApi(await customerConfig()).generateLinkToken({
        client_id: env.finverseClientId,
        user_id: userId,
        redirect_uri: env.finverseRedirectUri,
        state,
        response_mode: 'form_post',
        response_type: 'code',
        grant_type: 'client_credentials',
      });
      return res.data.link_url;
    },

    async exchangeCode(code) {
      const res = await new LinkApi(await customerConfig()).token(
        TokenGrantTypeEnum.AuthorizationCode,
        code,
        env.finverseClientId,
        env.finverseRedirectUri,
      );
      return toTokens(res.data);
    },

    async refreshTokens(refreshToken) {
      const res = await new CustomerApi(await customerConfig()).refreshToken({ refresh_token: refreshToken });
      return toTokens(res.data);
    },

    async getStatus(accessToken) {
      const res = await identity(accessToken).getLoginIdentity();
      return res.data.login_identity?.status ?? 'UNKNOWN';
    },

    async listAccounts(accessToken) {
      const res = await identity(accessToken).listAccounts();
      return (res.data.accounts ?? []).map(toAccount);
    },

    async listTransactions(accessToken) {
      const api = identity(accessToken);
      const all: Transaction[] = [];
      for (let offset = 0; ; ) {
        const res = await api.listTransactionsByLoginIdentityId(offset, PAGE_SIZE);
        const page = res.data.transactions ?? [];
        all.push(...page.map(toTransaction));
        offset += page.length;
        if (page.length === 0 || offset >= res.data.total_transactions) break;
      }
      return all;
    },
  };
}

export function toAccount(a: FvAccount): Account {
  return {
    id: a.account_id,
    name: a.account_nickname || a.account_name,
    type: a.account_type?.type ?? null,
    currency: a.account_currency ?? a.balance?.currency ?? DEFAULT_CURRENCY,
    balance: a.balance?.value ?? null,
    maskedNumber: a.account_number_masked ?? null,
  };
}

export function toTransaction(t: FvTransaction): Transaction {
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    postedDate: (t.posted_date ?? t.transaction_time ?? t.created_at ?? '').slice(0, 10),
    amount: t.amount?.value ?? 0,
    currency: t.amount?.currency ?? DEFAULT_CURRENCY,
    description: t.description ?? '',
    merchantName: t.merchant_name ?? null,
    category: t.category ?? null,
    isPending: t.is_pending,
  };
}
