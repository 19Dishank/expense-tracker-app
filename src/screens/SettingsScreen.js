import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Modal, Pressable, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DayPicker from '../components/DayPicker';
import { useAppContext } from '../context/AppContext';
import { setSetting, clearAllTransactions, resetEntireApp } from '../db/database';
import { getPeriodForDate } from '../utils/period';
import { useDialog } from '../utils/confirm';
import AppDialog from '../components/AppDialog';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';

const THEME_OPTIONS = [
  {
    key: 'system',
    label: 'System default',
    sub: 'Follows your device settings',
    icon: 'cellphone',
  },
  {
    key: 'light',
    label: 'Light mode',
    sub: 'Clean, bright aesthetic',
    icon: 'white-balance-sunny',
  },
  {
    key: 'dark',
    label: 'Dark mode',
    sub: 'Easy on the eyes at night',
    icon: 'moon-waning-crescent',
  },
];

export default function SettingsScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay, setStartDay, biometricEnabled, setBiometricEnabled } = useAppContext();
  const { themePreference, setThemePreference, colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm, showInfo } = useDialog();

  const [modalVisible, setModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(startDay);

  function openDayModal() {
    setSelectedDay(startDay);
    setModalVisible(true);
  }

  async function handleSaveDay() {
    console.log('Changing period start day to:', selectedDay);
    await setSetting(db, 'period_start_day', selectedDay);
    setStartDay(selectedDay);
    setModalVisible(false);
  }

  function handleSelectTheme(pref) {
    console.log('Switching theme to:', pref);
    setThemePreference(pref);
    setThemeModalVisible(false);
  }

  // Toggle biometric lock on/off and persist to settings
  async function handleToggleBiometric(value) {
    console.log('Biometric lock toggled:', value);
    await setSetting(db, 'biometric_lock', value ? 'true' : 'false');
    setBiometricEnabled(value);
    if (value) {
      showInfo(
        'Biometric Lock Enabled',
        'The app will ask for fingerprint / Face ID every time it opens.',
        { icon: 'fingerprint', iconColor: colors.accent }
      );
    }
  }

  // TEMPORARY TEST HELPER - remove after testing
  function handleClearAll() {
    showConfirm(
      'Clear all entries',
      'This permanently deletes every expense and income entry. Categories and settings are kept. For testing only.',
      async () => {
        await clearAllTransactions(db);
        showInfo('Done', 'All entries were cleared.', { icon: 'check-circle-outline', iconColor: colors.income });
      },
      { icon: 'delete-sweep-outline', iconColor: colors.expense, actionLabel: 'Clear All' }
    );
  }

  // TEMPORARY TEST HELPER - remove after testing
  function handleResetApp() {
    showConfirm(
      'Reset app completely?',
      'This deletes all entries, custom categories and settings, re-seeds the 6 default categories, and returns to the setup screen.',
      async () => {
        await resetEntireApp(db);
        setStartDay(null);
      },
      { icon: 'restart', iconColor: colors.expense, actionLabel: 'Reset App' }
    );
  }

  // Shows what the current period would be with the picked day
  const preview = getPeriodForDate(selectedDay);

  const currentThemeLabel =
    themePreference === 'system'
      ? `System (${isDark ? 'Dark' : 'Light'})`
      : themePreference === 'dark'
      ? 'Dark'
      : 'Light';

  const currentThemeIcon =
    themePreference === 'dark'
      ? 'moon-waning-crescent'
      : themePreference === 'light'
      ? 'white-balance-sunny'
      : 'theme-light-dark';

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

        {/* Theme appearance selector */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => setThemeModalVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name={currentThemeIcon} size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Theme</Text>
            <Text style={styles.rowSub}>{currentThemeLabel}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Biometric lock */}
        <View style={styles.row}>
          <MaterialCommunityIcons name="fingerprint" size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Biometric lock</Text>
            <Text style={styles.rowSub}>Require fingerprint / Face ID on open</Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={'#FFFFFF'}
          />
        </View>

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

      {/* Theme selection sheet */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setThemeModalVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Appearance</Text>
            {THEME_OPTIONS.map((opt, i) => {
              const selected = themePreference === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeOptionRow,
                    selected && styles.themeOptionRowSelected,
                    i !== THEME_OPTIONS.length - 1 && styles.themeOptionDivider,
                  ]}
                  onPress={() => handleSelectTheme(opt.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.themeIconCircle, selected && styles.themeIconCircleSelected]}>
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={22}
                      color={selected ? colors.accentText : colors.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeOptionTitle, selected && styles.themeOptionTitleSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.themeOptionSub}>{opt.sub}</Text>
                  </View>
                  {selected && (
                    <MaterialCommunityIcons name="check-circle" size={22} color={colors.income} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

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

      {/* Custom in-app dialogs (replaces system Alert) */}
      <AppDialog {...dialogProps} />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
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
    saveText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },

    themeOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    themeOptionRowSelected: {
      backgroundColor: colors.chip + '66',
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
    },
    themeOptionDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    themeIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeIconCircleSelected: {
      backgroundColor: colors.accent,
    },
    themeOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    themeOptionTitleSelected: {
      color: colors.text,
      fontWeight: '700',
    },
    themeOptionSub: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
