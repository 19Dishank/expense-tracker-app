import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { startFirstPeriod } from '../db/database';
import { toDateString, formatDisplayDate } from '../utils/period';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';

// Shown only on the very first launch.
// Your salary does not arrive on the same day every month, so there is no "start day".
// A period starts on the day your salary arrives, and you start the next one yourself.
export default function SetupScreen({ onDone }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  async function handleContinue() {
    const dateStr = toDateString(date);
    console.log('Starting first period on:', dateStr);
    await startFirstPeriod(db, dateStr);
    onDone();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>When did your last salary arrive?</Text>
      <Text style={styles.sub}>
        Your first period starts on this day. When your next salary arrives, tap the period at the
        top of the Dashboard to start a new one. A period can be short or long, it ends only when you
        start the next one.
      </Text>

      <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.text} />
        <Text style={styles.dateText}>{formatDisplayDate(toDateString(date))}</Text>
      </TouchableOpacity>

      <View style={styles.chipRow}>
        <TouchableOpacity style={styles.chip} onPress={() => setDate(new Date())}>
          <Text style={styles.chipText}>Today</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            setShowPicker(false);
            if (event.type === 'set' && selected) {
              setDate(selected);
            }
          }}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: spacing.xl },
    title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
    sub: { fontSize: 15, color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      marginTop: spacing.xl,
    },
    dateText: { fontSize: 18, fontWeight: '600', color: colors.text },
    chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    chipText: { fontSize: 14, color: colors.text },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 'auto',
    },
    buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  });
