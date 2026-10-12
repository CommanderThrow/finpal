import { formatMoney, type Account } from '@finpal/shared';
import { Link, Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { startBankLink } from '../lib/link';
import { supabase } from '../lib/supabase';

export default function Home() {
  const { session, loading } = useAuth();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      api<{ accounts: Account[] }>('/accounts')
        .then((res) => setAccounts(res.accounts))
        .catch((e: Error) => setError(e.message));
    }, [session]),
  );

  if (loading) return <ActivityIndicator style={styles.center} />;
  if (!session) return <Redirect href="/sign-in" />;

  async function linkBank() {
    setLinking(true);
    setError(null);
    try {
      const result = await startBankLink();
      if (result === 'ok' || result === 'error') router.push({ pathname: '/linked', params: { status: result } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLinking(false);
    }
  }

  const total = accounts?.reduce((sum, a) => sum + (a.balance ?? 0), 0) ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total balance</Text>
      <Text style={styles.amount}>{formatMoney(total)}</Text>
      {accounts === null && !error ? <ActivityIndicator /> : null}
      {accounts?.length === 0 ? <Text style={styles.muted}>Link a bank to see your spending and goals.</Text> : null}
      {accounts?.map((a) => (
        <View key={a.id} style={styles.row}>
          <Text>
            {a.name} {a.maskedNumber ? `· ${a.maskedNumber}` : ''}
          </Text>
          <Text>{a.balance === null ? '–' : formatMoney(a.balance, a.currency)}</Text>
        </View>
      ))}
      <Pressable style={styles.primary} disabled={linking} onPress={linkBank}>
        <Text style={styles.primaryText}>{linking ? 'Opening Finverse…' : 'Link a bank'}</Text>
      </Pressable>
      {accounts && accounts.length > 0 ? (
        <Link href="/transactions" style={styles.link}>
          See transactions
        </Link>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  container: { flex: 1, padding: 24, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  label: { fontSize: 16, color: '#555' },
  amount: { fontSize: 40, fontWeight: '700' },
  muted: { color: '#777' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  primary: { marginTop: 12, backgroundColor: '#1f6feb', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#1f6feb', fontSize: 16, paddingVertical: 8 },
  error: { color: '#c62828' },
  button: { marginTop: 24, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignSelf: 'flex-start' },
  buttonText: { fontSize: 16 },
});
