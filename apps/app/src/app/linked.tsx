import type { SyncResult } from '@finpal/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const POLL_MS = 3000;
const MAX_POLLS = 20;

/** Landing page after Finverse Link: waits for Finverse to finish fetching data. */
export default function Linked() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const { session } = useAuth();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [failed, setFailed] = useState(status !== 'ok');

  useEffect(() => {
    if (status !== 'ok' || !session) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < MAX_POLLS && !cancelled; i++) {
        try {
          const res = await api<SyncResult>('/sync', { method: 'POST' });
          if (cancelled) return;
          setResult(res);
          if (res.status !== 'pending') return;
        } catch {
          if (!cancelled) setFailed(true);
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session]);

  const done = result && result.status !== 'pending';

  return (
    <View style={styles.container}>
      {failed || result?.status === 'error' ? (
        <Text style={styles.title}>Linking didn't finish. Try again from the home screen.</Text>
      ) : done ? (
        <Text style={styles.title}>
          Bank linked: {result.accounts} accounts and {result.transactions} transactions synced.
        </Text>
      ) : (
        <>
          <ActivityIndicator />
          <Text style={styles.title}>Fetching your accounts and transactions…</Text>
        </>
      )}
      <Link href="/" style={styles.link}>
        Back to home
      </Link>
      {done && result.status === 'ready' ? (
        <Link href="/transactions" style={styles.link}>
          See transactions
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: 18 },
  link: { color: '#1f6feb', fontSize: 16 },
});
