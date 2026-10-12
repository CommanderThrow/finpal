import { DEFAULT_CATEGORIES, formatMoney, UNCATEGORISED, type Transaction } from '@finpal/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '../lib/api';
import { useApi } from '../lib/useApi';

export default function Transactions() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams({ limit: '200' });
  if (query) params.set('search', query);
  if (category) params.set('category', category);
  const { data, error, reload } = useApi<{ transactions: Transaction[] }>(`/transactions?${params}`);

  const categories = useMemo(() => {
    const seen = new Set(DEFAULT_CATEGORIES);
    for (const t of data?.transactions ?? []) if (t.category) seen.add(t.category);
    return [...seen];
  }, [data]);

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <TextInput style={styles.search} placeholder="Search merchant or description" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={category === null} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator style={styles.center} /> : null}
      {data ? (
        <FlatList
          data={data.transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>No transactions match.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setEditing(item)}>
              <View style={styles.main}>
                <Text style={styles.name}>{item.merchantName ?? item.description}</Text>
                <Text style={styles.muted}>
                  {item.postedDate} · {item.category ?? UNCATEGORISED}
                  {item.isPending ? ' · pending' : ''}
                </Text>
              </View>
              <Text style={[styles.amount, item.amount < 0 ? styles.out : styles.in]}>
                {formatMoney(item.amount, item.currency)}
              </Text>
            </Pressable>
          )}
        />
      ) : null}

      <CategoryPicker
        transaction={editing}
        categories={categories.filter((c) => c !== UNCATEGORISED)}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={active ? styles.chipTextActive : undefined}>{label}</Text>
    </Pressable>
  );
}

function CategoryPicker(props: {
  transaction: Transaction | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { transaction, categories, onClose, onSaved } = props;
  const [applyToMerchant, setApplyToMerchant] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(category: string) {
    if (!transaction) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/transactions/${encodeURIComponent(transaction.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ category, applyToMerchant: applyToMerchant && !!transaction.merchantName }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={transaction !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Category for {transaction?.merchantName ?? transaction?.description}</Text>
        {transaction?.merchantName ? (
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Use for every {transaction.merchantName} transaction</Text>
            <Switch value={applyToMerchant} onValueChange={setApplyToMerchant} />
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.options}>
          {categories.map((c) => (
            <Pressable key={c} disabled={saving} style={styles.option} onPress={() => choose(c)}>
              <Text style={[styles.optionText, c === transaction?.category && styles.optionCurrent]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1 },
  filters: { padding: 16, paddingBottom: 0, gap: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee', gap: 12 },
  main: { flex: 1 },
  name: { fontSize: 16 },
  muted: { color: '#777' },
  amount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  out: { color: '#222' },
  in: { color: '#2e7d32' },
  error: { color: '#c62828', padding: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', padding: 20, gap: 12, maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { flex: 1, color: '#555' },
  options: { gap: 4 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  optionText: { fontSize: 16 },
  optionCurrent: { fontWeight: '700', color: '#1f6feb' },
});
