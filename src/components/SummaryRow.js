import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { formatINR } from '../utils/money';

// Small helper: one labelled number
function Column({ label, value, color }) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

// Income / Expense / Savings in one row.
// For the current period the third column is called "Remaining" because it is not final yet.
export default function SummaryRow({ income, expense, savings, isCurrent }) {
  return (
    <View style={styles.row}>
      <Column label="Income" value={formatINR(income)} color={colors.income} />
      <Column label="Expense" value={formatINR(expense)} color={colors.expense} />
      <Column
        label={isCurrent ? 'Remaining' : 'Savings'}
        value={formatINR(savings)}
        color={savings < 0 ? colors.expense : colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1 },
  label: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});

