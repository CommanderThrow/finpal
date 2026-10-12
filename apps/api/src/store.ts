import { UNCATEGORISED, type Account, type Transaction } from '@finpal/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Sealer } from './crypto';
import type { BankTokens } from './finverse';

export interface Connection extends BankTokens {
  id: string;
  userId: string;
  status: string;
}

export interface TransactionQuery {
  limit: number;
  offset: number;
  /** Matches description or merchant name, case-insensitively. */
  search?: string;
  /** Effective category; UNCATEGORISED matches transactions with none. */
  category?: string;
  /** Inclusive YYYY-MM-DD bounds on the posted date. */
  from?: string;
  to?: string;
}

export interface Store {
  /** Saves a new connection, or replaces the tokens of a relinked one. */
  saveConnection(userId: string, tokens: BankTokens): Promise<void>;
  listConnections(userId: string): Promise<Connection[]>;
  updateConnection(id: string, patch: { tokens?: BankTokens; status?: string }): Promise<void>;
  saveAccounts(userId: string, connectionId: string, accounts: Account[]): Promise<void>;
  saveTransactions(userId: string, transactions: Transaction[]): Promise<void>;
  listAccounts(userId: string): Promise<Account[]>;
  listTransactions(userId: string, query: TransactionQuery): Promise<Transaction[]>;
  /** Sets the user's own category on one transaction; null if it isn't theirs. */
  setCategory(userId: string, transactionId: string, category: string): Promise<Transaction | null>;
  /** Files every transaction from a merchant, now and on future syncs, under a category. */
  setMerchantRule(userId: string, merchantName: string, category: string): Promise<void>;
  /** Applies the user's merchant rules to transactions they haven't categorised themselves. */
  applyCategoryRules(userId: string): Promise<void>;
}

const BATCH = 500;

/** Characters PostgREST treats as syntax inside an or() filter. */
const stripFilterSyntax = (text: string) => text.replace(/[,()*"\\%]/g, ' ').trim();

const toTransaction = (r: any): Transaction => ({
  id: r.id,
  accountId: r.account_id,
  postedDate: r.posted_date ?? '',
  amount: Number(r.amount),
  currency: r.currency,
  description: r.description,
  merchantName: r.merchant_name,
  category: r.effective_category,
  isPending: r.is_pending,
});

export function createSupabaseStore(url: string, serviceRoleKey: string, sealer: Sealer): Store {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const check = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
    if (error) throw new Error(`Database error: ${error.message}`);
    return data;
  };

  const sealTokens = (t: BankTokens) => ({
    access_token_enc: sealer.encrypt(t.accessToken),
    refresh_token_enc: sealer.encrypt(t.refreshToken),
    token_expires_at: t.expiresAt.toISOString(),
  });

  return {
    async saveConnection(userId, tokens) {
      check(
        await db.from('bank_connections').upsert(
          { user_id: userId, login_identity_id: tokens.loginIdentityId, ...sealTokens(tokens), status: 'LINKING' },
          { onConflict: 'login_identity_id' },
        ),
      );
    },

    async listConnections(userId) {
      const rows = check(await db.from('bank_connections').select('*').eq('user_id', userId)) ?? [];
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        loginIdentityId: r.login_identity_id,
        accessToken: sealer.decrypt(r.access_token_enc),
        refreshToken: sealer.decrypt(r.refresh_token_enc),
        expiresAt: new Date(r.token_expires_at),
      }));
    },

    async updateConnection(id, { tokens, status }) {
      check(
        await db
          .from('bank_connections')
          .update({
            ...(tokens ? sealTokens(tokens) : {}),
            ...(status ? { status } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id),
      );
    },

    async saveAccounts(userId, connectionId, accounts) {
      if (accounts.length === 0) return;
      check(
        await db.from('accounts').upsert(
          accounts.map((a) => ({
            id: a.id,
            user_id: userId,
            connection_id: connectionId,
            name: a.name,
            type: a.type,
            currency: a.currency,
            balance: a.balance,
            masked_number: a.maskedNumber,
            updated_at: new Date().toISOString(),
          })),
        ),
      );
    },

    async saveTransactions(userId, transactions) {
      for (let i = 0; i < transactions.length; i += BATCH) {
        check(
          await db.from('transactions').upsert(
            transactions.slice(i, i + BATCH).map((t) => ({
              id: t.id,
              user_id: userId,
              account_id: t.accountId,
              posted_date: t.postedDate || null,
              amount: t.amount,
              currency: t.currency,
              description: t.description,
              merchant_name: t.merchantName,
              category: t.category,
              is_pending: t.isPending,
              updated_at: new Date().toISOString(),
            })),
            // user_category is left out, so a resync keeps the user's own category.
          ),
        );
      }
    },

    async listAccounts(userId) {
      const rows = check(await db.from('accounts').select('*').eq('user_id', userId).order('name')) ?? [];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        currency: r.currency,
        balance: r.balance === null ? null : Number(r.balance),
        maskedNumber: r.masked_number,
      }));
    },

    async listTransactions(userId, { limit, offset, search, category, from, to }) {
      let q = db.from('transactions').select('*').eq('user_id', userId);
      if (from) q = q.gte('posted_date', from);
      if (to) q = q.lte('posted_date', to);
      if (category === UNCATEGORISED) q = q.is('effective_category', null);
      else if (category) q = q.eq('effective_category', category);
      const term = search ? stripFilterSyntax(search) : '';
      if (term) q = q.or(`description.ilike.*${term}*,merchant_name.ilike.*${term}*`);
      const rows =
        check(await q.order('posted_date', { ascending: false }).order('id').range(offset, offset + limit - 1)) ?? [];
      return rows.map(toTransaction);
    },

    async setCategory(userId, transactionId, category) {
      const rows =
        check(
          await db
            .from('transactions')
            .update({ user_category: category, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('id', transactionId)
            .select('*'),
        ) ?? [];
      return rows[0] ? toTransaction(rows[0]) : null;
    },

    async setMerchantRule(userId, merchantName, category) {
      check(
        await db
          .from('category_rules')
          .upsert({ user_id: userId, merchant_name: merchantName, category }, { onConflict: 'user_id,merchant_name' }),
      );
      check(
        await db
          .from('transactions')
          .update({ user_category: category, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('merchant_name', merchantName),
      );
    },

    async applyCategoryRules(userId) {
      const rules = check(await db.from('category_rules').select('*').eq('user_id', userId)) ?? [];
      for (const rule of rules) {
        check(
          await db
            .from('transactions')
            .update({ user_category: rule.category })
            .eq('user_id', userId)
            .eq('merchant_name', rule.merchant_name)
            .is('user_category', null),
        );
      }
    },
  };
}
