import { formatMoney } from '@finpal/shared';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function Home() {
  const { session, loading } = useAuth();
  const [backend, setBackend] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    if (!session) return;
    api<{ userId: string }>('/me')
      .then(() => setBackend('ok'))
      .catch(() => setBackend('down'));
  }, [session]);

  if (loading) return <ActivityIndicator style={styles.center} />;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Safe to spend this month</Text>
      <Text style={styles.amount}>{formatMoney(0)}</Text>
      <Text style={styles.muted}>Link a bank to see your spending and goals.</Text>
      <Text style={styles.muted}>
        Backend: {backend === 'checking' ? 'checking…' : backend === 'ok' ? 'connected' : 'not reachable'}
      </Text>
      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  container: { flex: 1, padding: 24, gap: 12 },
  label: { fontSize: 16, color: '#555' },
  amount: { fontSize: 40, fontWeight: '700' },
  muted: { color: '#777' },
  button: { marginTop: 24, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignSelf: 'flex-start' },
  buttonText: { fontSize: 16 },
});
