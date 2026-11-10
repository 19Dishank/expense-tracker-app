import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatDisplayDate } from '../utils/period';
import { useDialog } from '../utils/confirm';
import AppDialog from './AppDialog';
import CashConversionModal from './CashConversionModal';
import { CashStats } from './CashCard';
import { getCashConversionsForPeriod, getCashSummary, deleteCashConversion } from '../db/database';

// "Cash" section of the History period detail screen.
// Shows the cash numbers and every conversion of the period. Tap to edit, long press to delete.
// Nothing here is part of the income, expense or balance numbers above it.
export default function CashSection({ period }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm } = useDialog();

  const [summary, setSummary] = useState({ carriedForward: 0, converted: 0, cashSpent: 0, inWallet: 0 });
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState({ visible: false, editing: null });

  const load = useCallback(async () => {
    try {
      const s = await getCashSummary(db, period.start, period.end);
      const list = await getCashConversionsForPeriod(db, period.start, period.end);
      setSummary(s);
      setItems(list);
    } catch (e) {
      console.log('Cash section load error:', e.message);
    }
  }, [db, period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleSaved() {
    setModal({ visible: false, editing: null });
    load();
  }

  function handleLongPressDelete(item) {
    showConfirm(
      'Delete cash conversion',
      `Delete ${formatINR(item.amount)}? Your income, expenses and balance are not affected.`,
      async () => {
        await deleteCashConversion(db, item.id);
        load();
      },
      { icon: 'trash-can-outline', iconColor: colors.expense, actionLabel: 'Delete' }
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Cash</Text>
      <View style={styles.card}>
        <CashStats summary={summary} />

        <View style={styles.divider} />

        {items.length === 0 ? (
          <Text style={styles.emptyText}>No cash conversions in this period.</Text>
        ) : (
          items.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.row, index !== items.length - 1 && styles.rowDivider]}
              onPress={() => setModal({ visible: true, editing: item })}
              onLongPress={() => handleLongPressDelete(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="cash" size={20} color={colors.text} />
              </View>
              <View style={styles.middle}>
                <Text style={styles.rowTitle}>Converted to cash</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {formatDisplayDate(item.date) + (item.note ? ' · ' + item.note : '')}
                </Text>
              </View>
              <Text style={styles.rowAmount}>{formatINR(item.amount)}</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModal({ visible: true, editing: null })}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cash-plus" size={20} color={colors.text} />
          <Text style={styles.addText}>Convert to cash</Text>
        </TouchableOpacity>
      </View>

      <CashConversionModal
        visible={modal.visible}
        editing={modal.editing}
        onClose={() => setModal({ visible: false, editing: null })}
        onSaved={handleSaved}
      />
      <AppDialog {...dialogProps} />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: spacing.sm },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    middle: { flex: 1, marginHorizontal: spacing.md },
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rowAmount: { fontSize: 15, fontWeight: '600', color: colors.text },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 48,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    addText: { fontSize: 15, fontWeight: '600', color: colors.text },
  });

