import type { SyncResult, SyncStatus } from '@finpal/shared';

import type { FinverseClient } from './finverse';
import type { Store } from './store';

/** Finverse statuses after which a login identity's data can be read. */
const READY = new Set(['DATA_RETRIEVAL_COMPLETE', 'DATA_RETRIEVAL_PARTIALLY_SUCCESSFUL']);
const FAILED = new Set(['ERROR', 'UNLINKED', 'UNLINK_SUCCEEDED']);
const REFRESH_MARGIN_MS = 60_000;

/**
 * Pulls accounts and transactions for each of the user's bank connections whose
 * data Finverse has finished retrieving. Connections still retrieving are left
 * for the next call, so the app can call this repeatedly until it reports ready.
 */
export async function syncUser(
  userId: string,
  finverse: FinverseClient,
  store: Store,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const connections = await store.listConnections(userId);
  if (connections.length === 0) return { status: 'none', accounts: 0, transactions: 0 };

  const statuses: SyncStatus[] = [];
  let accounts = 0;
  let transactions = 0;

  for (const connection of connections) {
    let accessToken = connection.accessToken;
    if (connection.expiresAt.getTime() - REFRESH_MARGIN_MS < now()) {
      const tokens = await finverse.refreshTokens(connection.refreshToken);
      await store.updateConnection(connection.id, { tokens });
      accessToken = tokens.accessToken;
    }

    const status = await finverse.getStatus(accessToken);
    if (status !== connection.status) await store.updateConnection(connection.id, { status });

    if (FAILED.has(status)) {
      statuses.push('error');
      continue;
    }
    if (!READY.has(status)) {
      statuses.push('pending');
      continue;
    }

    const fetchedAccounts = await finverse.listAccounts(accessToken);
    await store.saveAccounts(userId, connection.id, fetchedAccounts);
    const fetchedTransactions = await finverse.listTransactions(accessToken);
    await store.saveTransactions(userId, fetchedTransactions);
    accounts += fetchedAccounts.length;
    transactions += fetchedTransactions.length;
    statuses.push('ready');
  }

  if (statuses.includes('ready')) await store.applyCategoryRules(userId);

  // Report pending while anything is still coming, so the app keeps polling.
  const status: SyncStatus = statuses.includes('pending')
    ? 'pending'
    : statuses.includes('ready')
      ? 'ready'
      : 'error';
  return { status, accounts, transactions };
}
