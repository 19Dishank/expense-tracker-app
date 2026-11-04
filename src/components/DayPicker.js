import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles, radius } from '../constants/theme';

// Days 1 to 28 (28 max so every month has that day)
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

// Grid of day buttons. Used on the setup screen and in Settings.
export default function DayPicker({ selectedDay, onSelect }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.grid}>
      {DAYS.map((day) => {
        const selected = day === selectedDay;
        return (
          <View key={day} style={styles.cell}>
            <TouchableOpacity
              style={[styles.day, selected && styles.daySelected]}
              onPress={() => onSelect(day)}
              activeOpacity={0.7}
              accessibilityLabel={`Day ${day}`}
            >
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    // 7 columns: each cell is 1/7 of the width and square
    cell: { width: '14.2857%', aspectRatio: 1, padding: 3 },
    day: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    daySelected: { backgroundColor: colors.accent },
    dayText: { fontSize: 16, color: colors.text },
    dayTextSelected: { color: colors.accentText, fontWeight: '600' },
  });
