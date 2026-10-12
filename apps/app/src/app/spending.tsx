import { addMonths, formatMoney, type MonthlySpending } from '@finpal/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApi } from '../lib/useApi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The current month in the device's time zone (UTC would be a day behind on the 1st in Malaysia). */
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export default function Spending() {
  const [month, setMonth] = useState(thisMonth);
  const { data, error } = useApi<MonthlySpending>(`/spending?month=${month}`);
  const max = Math.max(1, ...(data?.categories.flatMap((c) => [c.thisMonth, c.average]) ?? []));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={12}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthName(month)}</Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} disabled={month >= thisMonth()} hitSlop={12}>
          <Text style={[styles.nav, month >= thisMonth() && styles.disabled]}>›</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {data ? (
        <>
          <Text style={styles.total}>{formatMoney(data.total)}</Text>
          <Text style={styles.muted}>
            spent, against a {data.averageMonths}-month average of {formatMoney(data.averageTotal)}
          </Text>
          <View style={styles.legend}>
            <View style={[styles.swatch, styles.barThis]} />
            <Text style={styles.muted}>This month</Text>
            <View style={[styles.swatch, styles.barAvg]} />
            <Text style={styles.muted}>Average</Text>
          </View>
          {data.categories.length === 0 ? <Text style={styles.muted}>No spending in this period.</Text> : null}
          {data.categories.map((c) => (
            <View key={c.category} style={styles.category}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{c.category}</Text>
                <Text style={[styles.categoryAmount, c.thisMonth > c.average && c.average > 0 && styles.over]}>
                  {formatMoney(c.thisMonth)}
                </Text>
              </View>
              <View style={[styles.bar, styles.barThis, { width: `${(c.thisMonth / max) * 100}%` }]} />
              <View style={[styles.bar, styles.barAvg, { width: `${(c.average / max) * 100}%` }]} />
              <Text style={styles.muted}>avg {formatMoney(c.average)}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { fontSize: 28, color: '#1f6feb', paddingHorizontal: 8 },
  disabled: { color: '#ccc' },
  month: { fontSize: 18, fontWeight: '600' },
  total: { fontSize: 36, fontWeight: '700' },
  muted: { color: '#777' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  category: { gap: 4, paddingVertical: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryName: { fontSize: 16 },
  categoryAmount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  over: { color: '#c62828' },
  bar: { height: 8, borderRadius: 4, minWidth: 2 },
  barThis: { backgroundColor: '#1f6feb' },
  barAvg: { backgroundColor: '#b6c9e8' },
  error: { color: '#c62828' },
});
