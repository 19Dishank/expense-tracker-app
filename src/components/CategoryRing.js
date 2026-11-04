import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../constants/theme';
import {
  CELL_HEIGHT,
  ICON_SIZE,
  ICON_TOP,
  buildRingLayout,
  placeCategories,
  buildSlices,
} from '../utils/ringLayout';

// Plain absolute positioning (do not use StyleSheet.absoluteFillObject, it is removed in newer React Native)
const ABSOLUTE = { position: 'absolute', top: 0, left: 0 };

// Donut in the middle, categories around it.
//   categories            = active categories, each with { id, name, icon, color, total }
//   archivedSpending      = deleted categories that still have spending (slice only, no icon)
//   onCategoryPress       = called with the category when its icon is tapped (opens add expense)
//   onCategoryLongPress   = called with the category when its icon is long-pressed (shows stats)
//   onHoleTap             = called when the user taps the donut hole area (e.g. to dismiss highlight)
//   children              = content shown inside the donut hole
export default function CategoryRing({
  categories,
  archivedSpending = [],
  onCategoryPress,
  onCategoryLongPress,
  onHoleTap,
  children,
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const layout = buildRingLayout(width, categories.length);
  const placed = placeCategories(layout, categories);
  const { slices, rotation } = buildSlices(layout, placed, archivedSpending);

  const circumference = 2 * Math.PI * layout.ringRadius;
  const holeRadius = layout.ringRadius - layout.strokeWidth / 2;

  return (
    <View style={{ width: layout.width, height: layout.height }}>
      {/* Layer 1: ring and slices (touches pass through to the icons) */}
      <Svg width={layout.width} height={layout.height} style={[ABSOLUTE, { pointerEvents: 'none' }]}>
        {/* Fill the hole with the screen color so nothing shows through it */}
        <Circle cx={layout.cx} cy={layout.cy} r={holeRadius} fill={colors.background} />

        {/* Grey ring (also the empty state) */}
        <Circle
          cx={layout.cx}
          cy={layout.cy}
          r={layout.ringRadius}
          stroke={colors.border}
          strokeWidth={layout.strokeWidth}
          fill="none"
        />

        {/* Colored slices */}
        <G rotation={rotation - 90} origin={`${layout.cx}, ${layout.cy}`}>
          {slices.map((s) => {
            const length = s.fraction * circumference;
            return (
              <Circle
                key={'slice-' + s.id}
                cx={layout.cx}
                cy={layout.cy}
                r={layout.ringRadius}
                stroke={s.color}
                strokeWidth={layout.strokeWidth}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-s.fractionStart * circumference}
              />
            );
          })}
        </G>
      </Svg>

      {/* Layer 2: content inside the donut hole — tapping it calls onHoleTap */}
      <TouchableOpacity
        style={[
          ABSOLUTE,
          styles.hole,
          {
            left: layout.cx - layout.donutSize / 2,
            top: layout.cy - layout.donutSize / 2,
            width: layout.donutSize,
            height: layout.donutSize,
            paddingHorizontal: layout.strokeWidth + 8,
          },
        ]}
        onPress={onHoleTap}
        activeOpacity={1}
        accessibilityLabel="Dismiss category highlight"
      >
        {children}
      </TouchableOpacity>

      {/* Layer 3: category icons around the donut */}
      {placed.map((cat) => {
        const spent = cat.total > 0;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[ABSOLUTE, styles.cell, { left: cat.left, top: cat.top, width: layout.cellW, height: CELL_HEIGHT }]}
            onPress={() => onCategoryPress(cat)}
            onLongPress={() => onCategoryLongPress && onCategoryLongPress(cat)}
            activeOpacity={0.7}
            accessibilityLabel={`Add expense to ${cat.name}`}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: cat.color + '1F' },
                // Categories with spending have a colored border
                spent && { borderWidth: 1.5, borderColor: cat.color },
              ]}
            >
              <MaterialCommunityIcons name={cat.icon} size={26} color={cat.color} />
            </View>
            {/* Only show the category name — percent/amount removed per design update */}
            <Text style={styles.name} numberOfLines={1}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    hole: { alignItems: 'center', justifyContent: 'center' },
    cell: { alignItems: 'center', paddingTop: ICON_TOP },
    iconCircle: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { fontSize: 12, color: colors.text, marginTop: 4, maxWidth: '92%' },
  });
