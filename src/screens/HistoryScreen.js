import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SummaryRow from '../components/SummaryRow';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { getAllPeriods } from '../db/database';

export default function HistoryScreen({ navigation }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [periods, setPeriods] = useState([]);

  const load = useCallback(async () => {
    try {
      const list = await getAllPeriods(db);
      console.log('Periods loaded:', list.length);
      setPeriods(list);
    } catch (e) {
      console.log('History load error:', e.message);
    }
  }, [db]);

  // Reload whenever the tab is shown (entries may have changed)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PeriodDetail', { period: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{item.fullLabel}</Text>
          {item.isCurrent && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Current</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </View>
        <SummaryRow
          income={item.income}
          expense={item.expense}
          savings={item.savings}
          isCurrent={item.isCurrent}
        />
      </TouchableOpacity>
    );
  }

  // Compute totals for all past (completed) periods — derived from the already-loaded array,
  // not stored in state, so it stays in sync automatically.
  // Past = periods that started BEFORE the current one. A period that only exists because an
  // entry was dated in the future must not count as "saved".
  const currentPeriod = periods.find((p) => p.isCurrent);
  const pastPeriods = periods.filter((p) => currentPeriod && p.start < currentPeriod.start);
  const totalSavings = pastPeriods.reduce((s, p) => s + p.savings, 0);
  const totalIncome = pastPeriods.reduce((s, p) => s + p.income, 0);
  const totalExpense = pastPeriods.reduce((s, p) => s + p.expense, 0);

  // Only show the summary card when there is at least one completed period with data
  const showSavingsCard = pastPeriods.length > 0;

  function renderListHeader() {
    if (!showSavingsCard) {
      return null;
    }
    return (
      <View style={styles.savingsCard}>
        {/* Card title */}
        <View style={styles.savingsCardTop}>
          <MaterialCommunityIcons name="piggy-bank-outline" size={20} color={colors.income} />
          <Text style={styles.savingsCardTitle}>Total Savings</Text>
        </View>

        {/* Main savings figure */}
        <Text
          style={[
            styles.savingsAmount,
            { color: totalSavings >= 0 ? colors.income : colors.expense },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatINR(totalSavings)}
        </Text>
        <Text style={styles.savingsLabel}>Saved so far</Text>

        {/* Income and expense breakdown */}
        <View style={styles.savingsRow}>
          <View style={styles.savingsCol}>
            <Text style={styles.savingsColLabel}>Total income</Text>
            <Text style={[styles.savingsColValue, { color: colors.income }]}>
              {formatINR(totalIncome)}
            </Text>
          </View>
          <View style={styles.savingsCol}>
            <Text style={styles.savingsColLabel}>Total spent</Text>
            <Text style={[styles.savingsColValue, { color: colors.expense }]}>
              {formatINR(totalExpense)}
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.savingsNote}>Current period is not included</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={periods}
        keyExtractor={(item) => item.start}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={<Text style={styles.empty}>No periods yet.</Text>}
      />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, minHeight: 32 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: colors.accentText, fontSize: 11, fontWeight: '600' },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  // Total Savings card (shown above the period list)
  savingsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  savingsCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  savingsCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  savingsAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  savingsLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  savingsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  savingsCol: {
    flex: 1,
  },
  savingsColLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  savingsColValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  savingsNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});
