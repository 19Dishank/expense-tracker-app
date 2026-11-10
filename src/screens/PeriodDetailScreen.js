import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DonutChart from '../components/DonutChart';
import SummaryRow from '../components/SummaryRow';
import TransactionRow from '../components/TransactionRow';
import CashSection from '../components/CashSection';
import AddTransactionModal from '../components/AddTransactionModal';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { computePercents } from '../utils/ringLayout';
import { addRunningBalance } from '../utils/balance';
import { useDialog } from '../utils/confirm';
import AppDialog from '../components/AppDialog';
import {
  getPeriodTotals,
  getCategoryTotals,
  getTransactionsForPeriod,
  getCategories,
  getIncomeSources,
  deleteTransaction,
} from '../db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PeriodDetailScreen({ route, navigation }) {
  const { period } = route.params;
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [editing, setEditing] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const { dialogProps, showConfirm } = useDialog();

  // Show the period in the header, for example "15 Sep - 14 Oct"
  useEffect(() => {
    navigation.setOptions({ title: period.label });
  }, [navigation, period.label]);

  const load = useCallback(async () => {
    try {
      const t = await getPeriodTotals(db, period.start, period.end);
      const c = await getCategoryTotals(db, period.start, period.end);
      const tx = await getTransactionsForPeriod(db, period.start, period.end);
      const cats = await getCategories(db);
      const s = await getIncomeSources(db);
      setTotals(t);
      setCategoryTotals(c);
      setTransactions(tx);
      setCategories(cats);
      setIncomeSources(s);
    } catch (e) {
      console.log('Period detail load error:', e.message);
    }
  }, [db, period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Only categories that have spending in this period (including uncategorised / Other)
  const categorizedExpenseTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  const otherTotal = Math.max(0, totals.expense - categorizedExpenseTotal);

  const spentCategories = [...categoryTotals.filter((c) => c.total > 0)];
  if (otherTotal > 0 && !spentCategories.some((c) => c.name.toLowerCase() === 'other')) {
    spentCategories.push({
      id: 'other',
      name: 'Other',
      icon: 'dots-horizontal-circle-outline',
      color: '#8C8C8C',
      total: otherTotal,
    });
  }

  // Percentages that always add up to exactly 100 (plain rounding can give 101 or 99)
  const percents = computePercents(spentCategories);

  const donutData = spentCategories.map((c) => ({ id: c.id, value: c.total, color: c.color }));

  // All entries, oldest first, each one with the balance left right after it
  const entries = addRunningBalance(transactions);

  function handleLongPressDelete(item) {
    showConfirm(
      'Delete entry',
      `Delete ${formatINR(item.amount)}? This cannot be undone.`,
      async () => {
        await deleteTransaction(db, item.id);
        load();
      },
      { icon: 'trash-can-outline', iconColor: colors.expense, actionLabel: 'Delete' }
    );
  }

  function handleSaved() {
    setEditing(null);
    load();
  }

  function toggleCategory(catId) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  }

  function getEntriesForCategory(catId) {
    return transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      if (catId === 'other') {
        return t.category_id === null || t.category_id === undefined || t.category_id === 'other';
      }
      return String(t.category_id) === String(catId);
    });
  }

  // Draws a list of entries inside a white card
  function renderEntries(list, emptyText) {
    if (list.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        {list.map((item, index) => (
          <TransactionRow
            key={item.id}
            item={item}
            isLast={index === list.length - 1}
            balance={item.balance}
            onPress={() => setEditing(item)}
            onLongPress={() => handleLongPressDelete(item)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.fullLabel}>{period.fullLabel}</Text>

        {/* Summary */}
        <View style={styles.card}>
          <SummaryRow
            income={totals.income}
            expense={totals.expense}
            savings={totals.income - totals.expense}
            isCurrent={period.isCurrent}
          />
        </View>

        {/* Donut */}
        <View style={[styles.card, styles.donutCard]}>
          <DonutChart data={donutData} size={200} strokeWidth={24}>
            <Text style={styles.donutLabel}>Spent</Text>
            <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatINR(totals.expense)}
            </Text>
          </DonutChart>
        </View>

        {/* Category-wise totals */}
        <Text style={styles.sectionTitle}>By category</Text>
        <View style={styles.card}>
          {spentCategories.length === 0 ? (
            <Text style={styles.emptyText}>No expenses in this period.</Text>
          ) : (
            spentCategories.map((c, index) => {
              const isExpanded = !!expandedCategories[c.id];
              const catEntries = isExpanded ? getEntriesForCategory(c.id) : [];
              const isLastCat = index === spentCategories.length - 1;

              return (
                <View
                  key={c.id}
                  style={[styles.catAccordionItem, !isLastCat && styles.catDivider]}
                >
                  <TouchableOpacity
                    style={styles.catRow}
                    onPress={() => toggleCategory(c.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.catIcon, { backgroundColor: c.color + '1F' }]}>
                      <MaterialCommunityIcons name={c.icon} size={20} color={c.color} />
                    </View>
                    <Text style={styles.catName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.catPercent}>{percents[c.id] ? percents[c.id].label : ''}</Text>
                    <Text style={styles.catTotal}>{formatINR(c.total)}</Text>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.catEntriesContainer}>
                      {catEntries.length === 0 ? (
                        <Text style={styles.catEmptyText}>No entries in this category.</Text>
                      ) : (
                        catEntries.map((item, idx) => (
                          <TransactionRow
                            key={item.id}
                            item={item}
                            isLast={idx === catEntries.length - 1}
                            onPress={() => setEditing(item)}
                            onLongPress={() => handleLongPressDelete(item)}
                          />
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Income and expenses together, oldest first, with the running balance after each entry */}
        <Text style={styles.sectionTitle}>Entries ({entries.length})</Text>
        {renderEntries(entries, 'No entries in this period.')}

        {/* Cash conversions & wallet breakdown for this period */}
        <CashSection period={period} />

        <Text style={styles.hint}>Tap an entry to edit it. Long press to delete.</Text>
      </ScrollView>

      {/* Edit sheet (visible only while an entry is selected) */}
      <AddTransactionModal
        visible={editing !== null}
        type={editing ? editing.type : 'expense'}
        categories={categories}
        incomeSources={incomeSources}
        presetCategoryId={null}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      {/* Custom delete confirmation dialog */}
      <AppDialog {...dialogProps} />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  fullLabel: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  donutCard: { alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.xl },
  donutLabel: { fontSize: 12, color: colors.textMuted },
  donutAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  catAccordionItem: { overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing.md },
  catDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 15, color: colors.text },
  catPercent: { fontSize: 13, color: colors.textMuted },
  catTotal: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 70, textAlign: 'right' },
  catEntriesContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.xs,
  },
  catEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
