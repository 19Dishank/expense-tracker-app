import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DayPicker from '../components/DayPicker';
import { useAppContext } from '../context/AppContext';
import { setSetting, clearAllTransactions, resetEntireApp } from '../db/database';
import { getPeriodForDate } from '../utils/period';
import { confirmDelete } from '../utils/confirm';
import { colors, spacing, radius } from '../constants/theme';

export default function SettingsScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay, setStartDay } = useAppContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(startDay);

  function openDayModal() {
    setSelectedDay(startDay);
    setModalVisible(true);
  }

  async function handleSaveDay() {
    console.log('Changing period start day to:', selectedDay);
    await setSetting(db, 'period_start_day', selectedDay);
    // Updating the shared value makes every screen recalculate its period
    setStartDay(selectedDay);
    setModalVisible(false);
  }

  // TEMPORARY TEST HELPER - remove after testing
  function handleClearAll() {
    confirmDelete(
      'Clear all entries',
      'This permanently deletes every expense and income entry. Categories and settings are kept. For testing only.',
      async () => {
        await clearAllTransactions(db);
        Alert.alert('Done', 'All entries were cleared.');
      }
    );
  }

  // TEMPORARY TEST HELPER - remove after testing
  function handleResetApp() {
    confirmDelete(
      'Reset app completely?',
      'This deletes all entries, custom categories and settings, re-seeds the 6 default categories, and returns to the setup screen.',
      async () => {
        await resetEntireApp(db);
        setStartDay(null);
      }
    );
  }

  // Shows what the current period would be with the picked day
  const preview = getPeriodForDate(selectedDay);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Period start day */}
        <TouchableOpacity style={styles.row} onPress={openDayModal} activeOpacity={0.7}>
          <MaterialCommunityIcons name="calendar-refresh-outline" size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Period start day</Text>
            <Text style={styles.rowSub}>Day {startDay} of each month</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Manage categories */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('ManageCategories')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shape-outline" size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Manage categories</Text>
            <Text style={styles.rowSub}>Add, edit, reorder or delete</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* TEMPORARY TEST HELPER - disabled */}
        <TouchableOpacity style={[styles.row, { opacity: 0.4 }]} disabled activeOpacity={1}>
          <MaterialCommunityIcons name="delete-sweep-outline" size={24} color={colors.textMuted} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.textMuted }]}>Clear all entries (Disabled)</Text>
            <Text style={styles.rowSub}>Testing only. Deletes every expense and income.</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* TEMPORARY TEST HELPER - disabled */}
        <TouchableOpacity style={[styles.row, { opacity: 0.4 }]} disabled activeOpacity={1}>
          <MaterialCommunityIcons name="restart" size={24} color={colors.textMuted} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.textMuted }]}>Reset app (Disabled)</Text>
            <Text style={styles.rowSub}>Testing only. Re-seeds 6 default categories & opens setup.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Expense Tracker. All data stays on this phone.</Text>

      {/* Start day sheet */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Period start day</Text>
            <DayPicker selectedDay={selectedDay} onSelect={setSelectedDay} />

            <Text style={styles.preview}>Current period would be {preview.fullLabel}.</Text>

            <View style={styles.warning}>
              <MaterialCommunityIcons name="information-outline" size={20} color={colors.textMuted} />
              <Text style={styles.warningText}>
                Your entries are not changed, but History will regroup them using the new start day, so
                past period totals and savings will change.
              </Text>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveDay} activeOpacity={0.8}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: spacing.md },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  preview: { fontSize: 14, color: colors.text, marginTop: spacing.lg },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
