import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import DayPicker from '../components/DayPicker';
import { setSetting } from '../db/database';
import { getPeriodForDate } from '../utils/period';
import { useThemedStyles, spacing, radius } from '../constants/theme';

// Shown only on the very first launch
export default function SetupScreen({ onDone }) {
  const db = useSQLiteContext();
  const styles = useThemedStyles(createStyles);
  const [selectedDay, setSelectedDay] = useState(15);

  // Shows the user what their current period would look like
  const preview = getPeriodForDate(selectedDay);

  async function handleContinue() {
    console.log('Saving period start day:', selectedDay);
    await setSetting(db, 'period_start_day', selectedDay);
    onDone(selectedDay);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>When does your month start?</Text>
      <Text style={styles.sub}>
        Pick the day your salary arrives. Each period runs from this day to the day before the next
        one. You can change it later in Settings.
      </Text>

      <View style={styles.pickerWrap}>
        <DayPicker selectedDay={selectedDay} onSelect={setSelectedDay} />
      </View>

      <Text style={styles.example}>Your current period would be {preview.fullLabel}.</Text>

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
    pickerWrap: { marginTop: spacing.xl },
    example: { fontSize: 14, color: colors.textMuted, marginTop: spacing.lg },
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
