import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { getBudgetSummary, statusColor } from '../utils/budget';

// Smart balance card in the dashboard bottom bar.
// Collapsed: shows remaining amount, progress bar, % spent, and days left.
// Expanded: shows Income and Spent side by side.
// The card itself is NOT tappable to expand — only the chevron icon is.
export default function BalanceCard({ income, expense, periodStart, periodEnd }) {
  const [expanded, setExpanded] = useState(false);

  // Calculate budget summary numbers using the tested budget utility
  const summary = getBudgetSummary(income, expense, periodStart, periodEnd);
  const color = statusColor(summary.status);

  // Animated progress bar fill
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: summary.progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [summary.progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  function toggleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  }

  // Days left wording
  let daysText = `${summary.daysLeft} days left`;
  if (summary.daysLeft === 1) {
    daysText = '1 day left';
  } else if (summary.daysLeft === 0) {
    daysText = 'Period ended';
  }

  const isOver = summary.status === 'over';
  const isEmpty = summary.status === 'empty';

  return (
    <View style={styles.card}>
      {/* Top row: label, status chip and chevron */}
      <View style={styles.topRow}>
        <Text style={styles.remainingLabel}>Remaining balance</Text>
        <View style={styles.topRight}>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.chipText} numberOfLines={1}>
              {summary.message}
            </Text>
          </View>
          {/* Chevron is the ONLY tap target to expand/collapse the card */}
          <TouchableOpacity
            onPress={toggleExpand}
            style={styles.chevronButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Collapse balance details' : 'Expand balance details'}
          >
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Big amount */}
      <Text
        style={[styles.amount, isOver && { color: colors.expense }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Remaining balance ${formatINR(summary.remaining)}, ${summary.message}`}
      >
        {formatINR(isEmpty ? 0 : summary.remaining)}
      </Text>

      {/* Progress bar (hidden when status is empty) */}
      {!isEmpty && (
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: progressWidth,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      )}

      {/* Percent spent & days left row */}
      {!isEmpty && (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{summary.percentSpent}% of income spent</Text>
          <Text style={styles.infoText}>{daysText}</Text>
        </View>
      )}

      {/* Expanded breakdown */}
      {expanded && (
        <View style={styles.expandedWrap}>
          <View style={styles.divider} />

          <View style={styles.expandedRow}>
            {/* Income */}
            <View style={styles.col}>
              <Text style={styles.colLabel}>Income</Text>
              <Text style={[styles.colValue, { color: colors.income }]}>
                {formatINR(income)}
              </Text>
            </View>

            {/* Spent */}
            <View style={styles.col}>
              <Text style={styles.colLabel}>Spent</Text>
              <Text style={[styles.colValue, { color: colors.expense }]}>
                {formatINR(expense)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  remainingLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  // flexShrink lets a long status message shrink (with "...") instead of pushing the chevron off screen
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
    backgroundColor: colors.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  // Chevron button has a large tap target (48x48) for easy finger access
  chevronButton: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  track: {
    height: 8,
    backgroundColor: colors.chip,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expandedWrap: {
    marginTop: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  expandedRow: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
  },
  colLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  colValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});
