import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { getCashSummary } from '../db/database';
import CashConversionModal from './CashConversionModal';

// The three cash numbers. Used on the dashboard card and in the History period detail.
//   converted = cash you took out in this period
//   cashSpent = expenses marked "Paid in cash" in this period
//   inWallet  = all cash converted minus all cash spent, over ALL time (cash does not reset)
// None of these numbers is part of income, expense or the balance.
export function CashStats({ summary }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const negative = summary.inWallet < 0;

  return (
    <View>
      <View style={styles.statsRow}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Converted</Text>
          <Text style={styles.colValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(summary.converted)}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Cash spent</Text>
          <Text style={styles.colValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(summary.cashSpent)}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLabel}>In wallet</Text>
          <Text
            style={[styles.colValue, negative && { color: colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatINR(summary.inWallet)}
          </Text>
        </View>
      </View>
      <Text style={styles.note}>
        {negative
          ? 'You marked more cash expenses than you converted. Add the missing conversion.'
          : '"In wallet" counts all time. The other two are for this period.'}
      </Text>
    </View>
  );
}

// Dashboard card: shows the cash numbers and a button to add a conversion.
//   period        = the current period { start, end }
//   refreshKey    = any value that changes when the dashboard reloads (so the numbers stay fresh)
//   onOpenDetails = optional, opens the full list of conversions
export default function CashCard({ period, refreshKey, onOpenDetails }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [summary, setSummary] = useState({ converted: 0, cashSpent: 0, inWallet: 0 });
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getCashSummary(db, period.start, period.end);
      setSummary(s);
    } catch (e) {
      console.log('Cash card load error:', e.message);
    }
  }, [db, period.start, period.end]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function handleSaved() {
    setModalVisible(false);
    load();
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="cash" size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cash</Text>
          <Text style={styles.subtitle}>Separate from your balance</Text>
        </View>
        <TouchableOpacity
          style={styles.convertButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Convert to cash"
        >
          <MaterialCommunityIcons name="cash-plus" size={18} color={colors.text} />
          <Text style={styles.convertText}>Convert</Text>
        </TouchableOpacity>
        {onOpenDetails && (
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={onOpenDetails}
            activeOpacity={0.7}
            accessibilityLabel="See cash entries"
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider} />
      <CashStats summary={summary} />

      <CashConversionModal
        visible={modalVisible}
        editing={null}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    convertButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    convertText: { fontSize: 14, fontWeight: '600', color: colors.text },
    detailsButton: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    statsRow: { flexDirection: 'row', gap: spacing.md },
    col: { flex: 1 },
    colLabel: { fontSize: 12, color: colors.textMuted },
    colValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
    note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
  });

