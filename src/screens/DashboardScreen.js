import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryRing from '../components/CategoryRing';
import BalanceCard from '../components/BalanceCard';
import AddTransactionModal from '../components/AddTransactionModal';
import CategoryEditModal from '../components/CategoryEditModal';
import TransactionRow from '../components/TransactionRow';
import { useAppContext } from '../context/AppContext';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { getPeriodForDate } from '../utils/period';
import { formatINR } from '../utils/money';
import { computePercents } from '../utils/ringLayout';
import { useDialog } from '../utils/confirm';
import AppDialog from '../components/AppDialog';
import {
  getPeriodTotals,
  getCategoryTotals,
  getTransactionsForPeriod,
  getIncomeSources,
  deleteTransaction,
} from '../db/database';

// How many recent entries to show on the dashboard
const MAX_RECENT = 8;

// Virtual "Other" tile always appears last in the category ring.
// isVirtual flag tells CategoryRing and openCategory how to treat it.
const OTHER_VIRTUAL = {
  id: 'other',
  name: 'Other',
  icon: 'dots-horizontal-circle-outline',
  color: '#8C8C8C',
  total: 0,
  isVirtual: true,
};

export default function DashboardScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay } = useAppContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [period, setPeriod] = useState(() => getPeriodForDate(startDay));
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [recent, setRecent] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);

  // Controls the add/edit sheet
  const [modal, setModal] = useState({
    visible: false,
    type: 'expense',
    presetCategoryId: null,
    editing: null,
  });

  // Controls the CategoryEditModal (for "Create new category" from the expense drawer)
  const [catEditVisible, setCatEditVisible] = useState(false);

  // Remembers WHICH category was long-pressed (only its id, not a copy of its numbers)
  const [highlightedId, setHighlightedId] = useState(null);
  const { dialogProps, showConfirm } = useDialog();

  // Loads everything the dashboard shows
  const load = useCallback(async () => {
    try {
      const p = getPeriodForDate(startDay);
      const t = await getPeriodTotals(db, p.start, p.end);
      const c = await getCategoryTotals(db, p.start, p.end);
      const tx = await getTransactionsForPeriod(db, p.start, p.end);
      const s = await getIncomeSources(db);
      setPeriod(p);
      setTotals(t);
      setCategoryTotals(c);
      setRecent(tx);
      setIncomeSources(s);
    } catch (e) {
      console.log('Dashboard load error:', e.message);
    }
  }, [db, startDay]);

  // Reload every time this screen becomes visible
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The ring and the chooser show only active categories
  const activeCategoriesRaw = categoryTotals.filter((c) => !c.is_archived);

  // Deleted categories that still have spending keep a slice in the donut
  const archivedSpending = categoryTotals.filter((c) => c.is_archived && c.total > 0);

  // Calculate spending in the virtual "Other" category (expenses where category_id is NULL)
  const categorizedExpenseTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  const otherTotal = Math.max(0, totals.expense - categorizedExpenseTotal);

  const virtualOther = {
    ...OTHER_VIRTUAL,
    total: otherTotal,
  };

  // Add the virtual "Other" tile at the END unless the user already has a real "Other" category
  const hasOtherCategory = activeCategoriesRaw.some(
    (c) => c.name.toLowerCase() === 'other'
  );
  const activeCategories = hasOtherCategory
    ? activeCategoriesRaw
    : [...activeCategoriesRaw, virtualOther];

  // Look the highlighted category up again on every render, so its numbers always match the
  // latest data. A saved copy would go stale after adding or deleting an expense.
  const highlightedCat =
    highlightedId === null
      ? null
      : [...activeCategories, ...archivedSpending].find((c) => c.id === highlightedId) || null;

  // Percentages that always add up to exactly 100 (same math as the History screen)
  const percents = computePercents(
    [...activeCategories, ...archivedSpending].filter((c) => c.total > 0)
  );

  // ----- Opening the sheet in different modes -----
  function openCategory(category) {
    console.log('Category tapped:', category.name);
    if (category.isVirtual) {
      // Direct open in Add Expense drawer preset to Other
      console.log('Other tile tapped — opening expense drawer preset to Other');
      setModal({ visible: true, type: 'expense', presetCategoryId: 'other', editing: null });
      return;
    }
    setModal({ visible: true, type: 'expense', presetCategoryId: category.id, editing: null });
  }

  function openExpense() {
    console.log('Expense button tapped');
    setModal({ visible: true, type: 'expense', presetCategoryId: null, editing: null });
  }

  function openIncome() {
    console.log('Income button tapped');
    setModal({ visible: true, type: 'income', presetCategoryId: null, editing: null });
  }

  function openEdit(item) {
    console.log('Editing entry:', item.id);
    setModal({ visible: true, type: item.type, presetCategoryId: null, editing: item });
  }

  function closeModal() {
    setModal((m) => ({ ...m, visible: false }));
  }

  // Called by the sheet after a save or delete
  function handleSaved() {
    closeModal();
    load();
  }

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

  function openFullList() {
    // initial: false keeps the History list underneath so the back button works
    navigation.navigate('History', {
      screen: 'PeriodDetail',
      params: { period: { ...period, isCurrent: true } },
      initial: false,
    });
  }

  // Called after CategoryEditModal saves — reload categories so new one appears
  // If the expense drawer was open, switch it to the newly created category
  async function handleCatEditSaved(newCat) {
    setCatEditVisible(false);
    await load();
    if (newCat && newCat.id) {
      setModal((m) => ({
        ...m,
        presetCategoryId: newCat.id,
      }));
    }
  }

  const shownRecent = recent.slice(0, MAX_RECENT);

  // The content to show inside the donut hole — changes when a category is long-pressed
  function renderDonutCenter() {
    if (highlightedCat) {
      // Show stats for the highlighted category
      const pct = percents[highlightedCat.id] ? percents[highlightedCat.id].label : '0%';
      return (
        <>
          <Text style={styles.donutHighlightName} numberOfLines={1}>
            {highlightedCat.name}
          </Text>
          <Text style={styles.donutHighlightAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(highlightedCat.total)}
          </Text>
          <Text style={styles.donutHighlightPct}>{pct} of total</Text>
          <Text style={styles.donutDismiss}>tap to dismiss</Text>
        </>
      );
    }
    // Normal state — total spent and income
    return (
      <>
        <Text style={styles.donutLabel}>Spent</Text>
        <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatINR(totals.expense)}
        </Text>
        <Text style={styles.donutIncome} numberOfLines={1} adjustsFontSizeToFit>
          Income {formatINR(totals.income)}
        </Text>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Current period</Text>
          <Text style={styles.headerPeriod}>{period.label}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Open settings"
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cog-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category ring with donut in middle and categories around */}
        <View style={styles.ringWrapper}>
          <CategoryRing
            categories={activeCategories}
            archivedSpending={archivedSpending}
            onCategoryPress={openCategory}
            onCategoryLongPress={(cat) => setHighlightedId(cat.id)}
            onHoleTap={() => setHighlightedId(null)}
          >
            {renderDonutCenter()}
          </CategoryRing>
        </View>

        {/* Recent entries */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent entries</Text>
          {recent.length > MAX_RECENT && (
            <TouchableOpacity onPress={openFullList} style={styles.viewAll}>
              <Text style={styles.viewAllText}>View all ({recent.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {shownRecent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No entries in this period yet. Tap a category, or use the Expense and Income buttons below.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {shownRecent.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                isLast={index === shownRecent.length - 1}
                onPress={() => openEdit(item)}
                onLongPress={() => handleLongPressDelete(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <BalanceCard
          income={totals.income}
          expense={totals.expense}
          periodStart={period.start}
          periodEnd={period.end}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={openExpense}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="minus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={openIncome}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Income</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add / edit sheet */}
      <AddTransactionModal
        visible={modal.visible}
        type={modal.type}
        categories={activeCategoriesRaw}
        incomeSources={incomeSources}
        presetCategoryId={modal.presetCategoryId}
        editing={modal.editing}
        onClose={closeModal}
        onSaved={handleSaved}
        onAddNewCategory={() => setCatEditVisible(true)}
      />

      {/* Category create modal (can be opened directly from the Add Expense drawer) */}
      <CategoryEditModal
        visible={catEditVisible}
        category={null}
        onClose={() => setCatEditVisible(false)}
        onSaved={handleCatEditSaved}
      />

      {/* Custom in-app delete confirmation (replaces system Alert) */}
      <AppDialog {...dialogProps} />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerLabel: { fontSize: 13, color: colors.textMuted },
  headerPeriod: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // The bottom bar sits BELOW the scroll area (not on top of it), so only a small gap is needed
  scrollContent: { paddingBottom: spacing.lg },

  ringWrapper: { marginTop: 4, marginBottom: 8, alignItems: 'center' },
  donutLabel: { fontSize: 13, color: colors.textMuted },
  donutAmount: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  donutIncome: { fontSize: 12, color: colors.income, marginTop: spacing.xs },

  // Highlighted category state (long-press)
  donutHighlightName: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  donutHighlightAmount: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 2 },
  donutHighlightPct: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  donutDismiss: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  viewAll: { minHeight: 48, justifyContent: 'center' },
  viewAllText: { fontSize: 14, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
  },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, textAlign: 'center' },

  bottomBar: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    elevation: 8,
    gap: spacing.md,
  },

  buttonRow: { flexDirection: 'row', gap: spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  expenseButton: { backgroundColor: colors.expense },
  incomeButton: { backgroundColor: colors.income },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
