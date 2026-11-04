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
