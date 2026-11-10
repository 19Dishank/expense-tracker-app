import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { useDialog } from '../utils/confirm';
import AppDialog from './AppDialog';
import { formatINR } from '../utils/money';
import { getPeriodDays } from '../utils/budget';
import { addDays, toDateString, parseDateString, formatDisplayDate, OPEN_END } from '../utils/period';
import {
  getPeriodStarts,
  getPeriodTotals,
  getCashSummary,
  startNewPeriod,
  changeCurrentPeriodStart,
  removeCurrentPeriodStart,
} from '../db/database';

// Bottom sheet to manage the salary period.
// Salary does not arrive on the same day every month, so YOU decide when a period starts:
//   - "Start a new period": the day your salary arrived (it can be early or late, any length is fine)
//   - "Change start date": fix a wrong date on the current period
//   - "Go back to the previous period": undo a period started by mistake (no entry is deleted)
// Props:
//   visible, onClose
//   onChanged   = called after any change so the screen can reload
//   initialDate = optional 'YYYY-MM-DD'. When given, the sheet opens straight on "start a new period"
//                 with that date (used right after you add your salary).
export default function PeriodSheet({ visible, onClose, onChanged, initialDate = null }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm } = useDialog();

  const [starts, setStarts] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [cash, setCash] = useState({ carriedForward: 0, converted: 0, cashSpent: 0, inWallet: 0 });
  const [mode, setMode] = useState('menu'); // 'menu' | 'new' | 'edit'
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getPeriodStarts(db);
      setStarts(list);
      if (list.length > 0) {
        const current = list[list.length - 1];
        setTotals(await getPeriodTotals(db, current, OPEN_END));
        setCash(await getCashSummary(db, current, OPEN_END));
      }
    } catch (e) {
      console.log('Period sheet load error:', e.message);
    }
  }, [db]);

  // Every time the sheet opens
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError('');
    setShowPicker(false);
    setBusy(false);
    if (initialDate) {
      setMode('new');
      setDate(parseDateString(initialDate));
    } else {
      setMode('menu');
      setDate(new Date());
    }
    load();
  }, [visible, initialDate, load]);

  const todayStr = toDateString(new Date());
  const currentStart = starts.length > 0 ? starts[starts.length - 1] : null;
  const previousStart = starts.length > 1 ? starts[starts.length - 2] : null;
  const canStartNew = currentStart !== null && currentStart < todayStr;
  const dayNumber = currentStart ? getPeriodDays(currentStart, null).elapsedDays : 0;
  const dateStr = toDateString(date);

  // Earliest day the date picker allows
  let minimumDate;
  if (mode === 'new' && currentStart) {
    minimumDate = parseDateString(addDays(currentStart, 1));
  } else if (mode === 'edit' && previousStart) {
    minimumDate = parseDateString(addDays(previousStart, 1));
  }

  function openNew() {
    setError('');
    setDate(new Date());
    setMode('new');
  }

  function openEdit() {
    setError('');
    setDate(parseDateString(currentStart));
    setMode('edit');
  }

  async function handleConfirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mode === 'new') {
        await startNewPeriod(db, dateStr);
      } else {
        await changeCurrentPeriodStart(db, dateStr);
      }
      onChanged();
      onClose();
    } catch (e) {
      console.log('Period change failed:', e.message);
      setError(e.message);
      setBusy(false);
    }
  }

  function handleUndo() {
    showConfirm(
      'Go back to the previous period',
      `The period that started on ${formatDisplayDate(currentStart)} is removed. Its entries join the previous period, which started on ${formatDisplayDate(previousStart)}. No entry is deleted.`,
      async () => {
        try {
          await removeCurrentPeriodStart(db);
          onChanged();
          onClose();
        } catch (e) {
          console.log('Undo period failed:', e.message);
        }
      },
      { icon: 'undo-variant', iconColor: colors.expense, actionLabel: 'Go back' }
    );
  }

  const remaining = totals.income - totals.expense;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'new' ? 'Start a new period' : mode === 'edit' ? 'Change start date' : 'Salary period'}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {mode === 'menu' && (
              <View style={styles.body}>
                {currentStart && (
                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoTitle}>Current period</Text>
                      <Text style={styles.infoSub}>
                        Since {formatDisplayDate(currentStart)} · Day {dayNumber}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.explain}>
                  A period ends only when you start the next one, so it can be shorter or longer than a
                  month.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, !canStartNew && { opacity: 0.4 }]}
                  onPress={openNew}
                  disabled={!canStartNew}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryText}>Start a new period</Text>
                </TouchableOpacity>
                {!canStartNew && currentStart !== null && (
                  <Text style={styles.hint}>Your current period started today. Start the next one on a later day.</Text>
                )}

                <TouchableOpacity style={styles.secondaryButton} onPress={openEdit} activeOpacity={0.7}>
                  <Text style={styles.secondaryText}>Change start date</Text>
                </TouchableOpacity>

                {previousStart && (
                  <TouchableOpacity style={styles.textButton} onPress={handleUndo} activeOpacity={0.7}>
                    <Text style={styles.undoText}>Go back to the previous period</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {mode !== 'menu' && (
              <View style={styles.body}>
                <Text style={styles.label}>{mode === 'new' ? 'Salary received on' : 'This period starts on'}</Text>
                <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.text} />
                  <Text style={styles.dateText}>{formatDisplayDate(dateStr)}</Text>
                </TouchableOpacity>

                {mode === 'new' && (
                  <View style={styles.chipRow}>
                    <TouchableOpacity style={styles.chip} onPress={() => setDate(new Date())}>
                      <Text style={styles.chipText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chip} onPress={() => setDate(parseDateString(addDays(todayStr, -1)))}>
                      <Text style={styles.chipText}>Yesterday</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {showPicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    minimumDate={minimumDate}
                    maximumDate={new Date()}
                    onChange={(event, selected) => {
                      setShowPicker(false);
                      if (event.type === 'set' && selected) {
                        setDate(selected);
                      }
                    }}
                  />
                )}

                {mode === 'new' ? (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLine}>
                      The current period ends on {formatDisplayDate(addDays(dateStr, -1))}.
                    </Text>
                    <Text style={styles.previewLine}>
                      What is left of it ({formatINR(remaining)}) is saved as its Savings. The new period
                      starts empty.
                    </Text>
                    <Text style={styles.previewLine}>
                      Cash in your wallet ({formatINR(cash.inWallet)}) carries forward to the new period.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLine}>
                      Entries from {formatDisplayDate(dateStr)} onwards count in this period.
                      {previousStart ? ' Earlier entries move to the previous period.' : ''}
                    </Text>
                  </View>
                )}

                {error !== '' && <Text style={styles.error}>{error}</Text>}

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.backButton} onPress={() => setMode('menu')} activeOpacity={0.7}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, busy && { opacity: 0.6 }]}
                    onPress={handleConfirm}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryText}>{mode === 'new' ? 'Start period' : 'Save date'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <AppDialog {...dialogProps} />
    </>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    backdrop: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: spacing.xl,
      paddingRight: spacing.sm,
      paddingTop: spacing.sm,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: spacing.xl },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      padding: spacing.lg,
    },
    infoTitle: { fontSize: 13, color: colors.textMuted },
    infoSub: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 2 },
    explain: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: spacing.md },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
    secondaryButton: {
      backgroundColor: colors.chip,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
    undoText: { color: colors.expense, fontSize: 15, fontWeight: '600' },
    label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
    },
    dateText: { fontSize: 17, fontWeight: '600', color: colors.text },
    chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    chipText: { fontSize: 14, color: colors.text },
    previewBox: {
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.lg,
      gap: spacing.xs,
    },
    previewLine: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    error: { color: colors.expense, fontSize: 13, marginTop: spacing.md },
    buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    backButton: {
      flex: 1,
      backgroundColor: colors.chip,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButton: {
      flex: 2,
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

