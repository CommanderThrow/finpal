import { formatMoney, type Transaction } from '@finpal/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';

export default function Transactions() {
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ transactions: Transaction[] }>('/transactions?limit=200')
      .then((res) => setItems(res.transactions))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!items) return <ActivityIndicator style={styles.center} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.muted}>No transactions yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.main}>
            <Text style={styles.name}>{item.merchantName ?? item.description}</Text>
            <Text style={styles.muted}>
              {item.postedDate} · {item.category ?? 'Uncategorised'}
              {item.isPending ? ' · pending' : ''}
            </Text>
          </View>
          <Text style={[styles.amount, item.amount < 0 ? styles.out : styles.in]}>
            {formatMoney(item.amount, item.currency)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  list: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee', gap: 12 },
  main: { flex: 1 },
  name: { fontSize: 16 },
  muted: { color: '#777' },
  amount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  out: { color: '#222' },
  in: { color: '#2e7d32' },
  error: { color: '#c62828', padding: 24 },
});
