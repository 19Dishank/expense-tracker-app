import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { getBudgetSummary, getRemainingColor } from '../utils/budget';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Compact smart balance card in the dashboard bottom bar.
// Collapsed: sleek view showing label, remaining amount, conditional progress bar, and expand chevron (pointing up).
// Expanded: chevron flips downward, and card grows to show % spent, days left, and income/spent breakdown.
// Expand/collapse only occurs when tapping the chevron button.
export default function BalanceCard({ income, expense, periodStart, periodEnd }) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  // Calculate budget summary numbers using the tested budget utility
  const summary = getBudgetSummary(income, expense, periodStart, periodEnd);
  // Conditional color for progress bar:
  // High (> 50% left) => Green, Mid (25% - 50%) => Amber/Yellow, Low (10% - 25%) => Orange, Very low (< 10% or over) => Red
  const barColor = getRemainingColor(summary.remaining, income, colors, isDark);

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
      {/* Header row: label + amount on the left, chevron button on the right */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.remainingLabel}>Remaining balance</Text>
          <Text
            style={[styles.amount, isOver && { color: colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatINR(isEmpty ? 0 : summary.remaining)}
          </Text>
        </View>

        {/* Chevron is the ONLY tap target to expand/collapse the card */}
        <TouchableOpacity
          onPress={toggleExpand}
          style={styles.chevronButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Collapse balance details' : 'Expand balance details'}
        >
          <View style={styles.chevronWrap}>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Income spent progress bar with conditional color based on remaining balance */}
      {!isEmpty && (
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: progressWidth,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      )}

      {/* Expanded breakdown: % spent, days left, and income/spent details */}
      {expanded && (
        <View style={styles.expandedWrap}>
          {!isEmpty && (
            <View style={styles.infoRow}>
              <Text style={styles.infoText}>{summary.percentSpent}% of income spent</Text>
              <Text style={styles.infoText}>{daysText}</Text>
            </View>
          )}

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

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    headerLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    remainingLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
      marginBottom: 2,
    },
    amount: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    chevronButton: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.md,
    },
    chevronWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: {
      height: 6,
      backgroundColor: colors.chip,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    expandedWrap: {
      marginTop: spacing.xs,
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
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
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
