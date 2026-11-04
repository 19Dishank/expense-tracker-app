# Running balance on the History tab

Each entry in a period now shows the balance left right after it, on the same row.

**Where:** History tab, tap a period, then the **Entries** list.

```
+₹50,000   Salary          Bal ₹50,000
-₹5,000    Food            Bal ₹45,000
-₹1,000    Fuel            Bal ₹44,000
```

## How it works

- Income and expenses are now **one list** instead of two separate lists. A running balance only makes sense when they are mixed in time order.
- The balance starts at ₹0 at the start of every period. Nothing carries over, as in the rest of the app.
- The list is oldest first, so the balance reads top to bottom like your example.
- On the same date, income comes before expense. A salary received today is counted before today's spending, so the balance does not dip below zero for no reason.
- If an entry is backdated, edited or deleted, every balance after it is recalculated automatically. The list is rebuilt from the database each time, so nothing is stored.
- A negative balance is shown in red.
- The last balance in the list always equals the period's **Savings** (or **Remaining** for the current period) in the summary card at the top.
- The Dashboard "Recent entries" list is **not** changed. It still shows only the amount.

## Files

| File | Change |
|---|---|
| `src/utils/balance.js` | **New** |
| `src/components/TransactionRow.js` | Replace the whole file |
| `src/screens/PeriodDetailScreen.js` | Replace the whole file |

No database changes and no new packages.

## Step 1: create `src/utils/balance.js`

```js
// Running balance for a list of entries. All money is in paise.
// The balance starts at 0 for every period (nothing carries over from the previous period).

// Order rule: oldest date first. On the same date, income comes before expense
// (so a salary received today is counted before today's spending),
// then by entry order (id).
function compareEntries(a, b) {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (a.type !== b.type) {
    return a.type === 'income' ? -1 : 1;
  }
  return a.id - b.id;
}

// Returns a NEW list in that order. Every entry gets a "balance" field:
// the money left right after that entry.
export function addRunningBalance(transactions, startingBalance = 0) {
  const sorted = [...transactions].sort(compareEntries);
  let balance = startingBalance;
  return sorted.map((t) => {
    balance += t.type === 'income' ? t.amount : -t.amount;
    return { ...t, balance };
  });
}
```

## Step 2: replace `src/components/TransactionRow.js`

The only difference from your file is the optional `balance` prop and the right-hand column. When `balance` is not passed (the Dashboard), the row looks exactly as before.

```js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatDisplayDate } from '../utils/period';

// item comes from getTransactionsForPeriod (it includes category_name, category_icon, category_color)
// balance (optional) = money left right after this entry, in paise. When it is given, it is shown
// under the amount on the same row. When it is missing (for example on the dashboard), nothing changes.
export default function TransactionRow({ item, onPress, onLongPress, isLast, balance }) {
  const isExpense = item.type === 'expense';
  const hasBalance = typeof balance === 'number';

  // Expenses show the category icon (or Other for uncategorised), income shows a cash icon
  const iconName = isExpense ? item.category_icon || 'dots-horizontal-circle-outline' : 'cash-plus';
  const iconColor = isExpense ? item.category_color || '#8C8C8C' : colors.income;
  const title = isExpense ? item.category_name || 'Other' : item.source || 'Income';
  const subtitle = formatDisplayDate(item.date) + (item.note ? ' · ' + item.note : '');
  const sign = isExpense ? '-' : '+';

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '1F' }]}>
        <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: isExpense ? colors.expense : colors.income }]}>
          {sign + formatINR(item.amount)}
        </Text>
        {hasBalance && (
          <Text style={[styles.balance, balance < 0 && { color: colors.expense }]} numberOfLines={1}>
            Bal {formatINR(balance)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, marginHorizontal: spacing.md },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { fontSize: 15, fontWeight: '600' },
  balance: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
```

## Step 3: replace `src/screens/PeriodDetailScreen.js`

Changes from your file:
- New import: `addRunningBalance`.
- `incomeEntries` and `expenseEntries` are replaced by `entries = addRunningBalance(transactions)`.
- `renderEntries` passes `balance={item.balance}` to each row.
- The "Income" and "Expenses" sections are replaced by one "Entries" section.

```js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DonutChart from '../components/DonutChart';
import SummaryRow from '../components/SummaryRow';
import TransactionRow from '../components/TransactionRow';
import AddTransactionModal from '../components/AddTransactionModal';
import { colors, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { computePercents } from '../utils/ringLayout';
import { addRunningBalance } from '../utils/balance';
import { confirmDelete } from '../utils/confirm';
import {
  getPeriodTotals,
  getCategoryTotals,
  getTransactionsForPeriod,
  getCategories,
  getIncomeSources,
  deleteTransaction,
} from '../db/database';

export default function PeriodDetailScreen({ route, navigation }) {
  const { period } = route.params;
  const db = useSQLiteContext();

  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [editing, setEditing] = useState(null);

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
    confirmDelete('Delete entry', `Delete ${formatINR(item.amount)}? This cannot be undone.`, async () => {
      await deleteTransaction(db, item.id);
      load();
    });
  }

  function handleSaved() {
    setEditing(null);
    load();
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
            spentCategories.map((c, index) => (
              <View
                key={c.id}
                style={[styles.catRow, index !== spentCategories.length - 1 && styles.catDivider]}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color + '1F' }]}>
                  <MaterialCommunityIcons name={c.icon} size={20} color={c.color} />
                </View>
                <Text style={styles.catName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.catPercent}>{percents[c.id] ? percents[c.id].label : ''}</Text>
                <Text style={styles.catTotal}>{formatINR(c.total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Income and expenses together, oldest first, with the running balance after each entry */}
        <Text style={styles.sectionTitle}>Entries ({entries.length})</Text>
        {renderEntries(entries, 'No entries in this period.')}

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
    </View>
  );
}

const styles = StyleSheet.create({
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
  catRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing.md },
  catDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 15, color: colors.text },
  catPercent: { fontSize: 13, color: colors.textMuted },
  catTotal: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 80, textAlign: 'right' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
```

## Step 4: run

```bash
npx expo start -c
```

## Test it

1. Tap **Clear all entries** in Settings (testing helper) so the current period is empty.
2. Add income `50000` with source `Salary`. Then expense `5000` (Food) and expense `1000` (Fuel).
3. History tab, tap **Current**. Under **Entries** you should see:
   - `+₹50,000` with `Bal ₹50,000`
   - `-₹5,000` with `Bal ₹45,000`
   - `-₹1,000` with `Bal ₹44,000`
4. The summary card at the top shows Remaining `₹44,000`, the same as the last balance.
5. Tap the `-₹5,000` row, change it to `2000` and save. The balances become `₹50,000`, `₹48,000`, `₹47,000`.
6. Long-press the `-₹2,000` row and delete it. The last balance becomes `₹49,000`.
7. Add an expense dated 3 days ago. It appears above the others and every balance below it updates.
8. Add an expense larger than your income. Its balance is negative and shown in red.

## Optional: newest first

To show the newest entry at the top, change one line in `PeriodDetailScreen.js`. The balances stay correct, because each one is calculated before the list is flipped.

```js
const entries = addRunningBalance(transactions).reverse();
```
