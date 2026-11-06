import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { rupeesToPaise, paiseToRupeesString } from '../utils/money';
import { toDateString, parseDateString, formatDisplayDate } from '../utils/period';
import { useDialog } from '../utils/confirm';
import AppDialog from './AppDialog';
import { addCashConversion, updateCashConversion, deleteCashConversion } from '../db/database';

// Bottom sheet to add, edit or delete a "converted to cash" entry.
// These entries never touch income, expenses or the balance.
//   editing = the entry being edited, or null when adding a new one
export default function CashConversionModal({ visible, editing, onClose, onSaved }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm } = useDialog();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Screen height for the bottom-sheet slide animation
  const SCREEN_HEIGHT = Dimensions.get('window').height;

  // Internal modal visibility so exit animations can play before unmounting
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Manage enter and exit animations when `visible` changes
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  // Smooth dismiss animation before calling onClose
  function handleDismiss() {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }

  // Reset the form only when the sheet OPENS, never while it is already open
  const wasVisible = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) {
      return;
    }
    wasVisible.current = true;
    setError('');
    setShowPicker(false);
    setSaving(false);
    if (editing) {
      setAmount(paiseToRupeesString(editing.amount));
      setDate(parseDateString(editing.date));
      setNote(editing.note || '');
    } else {
      setAmount('');
      setDate(new Date());
      setNote('');
    }
  }, [visible, editing]);

  function pickQuickDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(d);
  }

  async function handleSave() {
    const paise = rupeesToPaise(amount);
    if (paise === null) {
      setError('Enter an amount from 0.01 up to 9,99,99,999');
      return;
    }
    const data = {
      amount: paise,
      date: toDateString(date),
      note: note.trim() === '' ? null : note.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateCashConversion(db, editing.id, data);
      } else {
        await addCashConversion(db, data);
      }
      onSaved();
    } catch (e) {
      console.log('Cash conversion save failed:', e);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  }

  function handleDelete() {
    // Guard: only called when editing is non-null (the Delete button is hidden otherwise)
    if (!editing) return;
    showConfirm(
      'Delete cash conversion',
      'This removes the entry. Your income, expenses and balance are not affected.',
      async () => {
        await deleteCashConversion(db, editing.id);
        onSaved();
      },
      { icon: 'trash-can-outline', iconColor: colors.expense, actionLabel: 'Delete' }
    );
  }

  return (
    <>
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleDismiss}>
        <View style={styles.overlay}>
          {/* Stationary animated backdrop: fades in/out, never slides from bottom */}
          <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]}>
            <Pressable style={styles.backdropTap} onPress={handleDismiss} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            {/* Animated bottom sheet: slides up from bottom */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <MaterialCommunityIcons name="cash" size={20} color={colors.text} />
                  </View>
                  <Text style={styles.title}>{editing ? 'Edit cash conversion' : 'Convert to cash'}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={handleDismiss} accessibilityLabel="Close">
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.explain}>
                Money you took out as physical cash (e.g. from an ATM, UPI cash-out, or got cash from a friend). It is shown separately and never changes your balance.
              </Text>

              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={13}
                />
              </View>
              {error !== '' && <Text style={styles.error}>{error}</Text>}

              {/* Date */}
              <View style={styles.section}>
                <Text style={styles.label}>Date</Text>
                <View style={styles.dateContainer}>
                  <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.text} />
                    <Text style={styles.dateText}>{formatDisplayDate(toDateString(date))}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => pickQuickDate(0)} activeOpacity={0.7}>
                    <Text style={styles.quickChipText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => pickQuickDate(1)} activeOpacity={0.7}>
                    <Text style={styles.quickChipText}>Yesterday</Text>
                  </TouchableOpacity>
                </View>
                {showPicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                      setShowPicker(false);
                      if (event.type === 'set' && selected) {
                        setDate(selected);
                      }
                    }}
                  />
                )}
              </View>

              {/* Note */}
              <View style={styles.section}>
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="ATM, UPI cash-out, from a friend..."
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveText}>{editing ? 'Save changes' : 'Save'}</Text>
              </TouchableOpacity>

              {editing && (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
                  <Text style={styles.deleteText}>Delete entry</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <AppDialog {...dialogProps} />
  </>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdropFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    backdropTap: { flex: 1 },
    keyboardAvoid: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: spacing.lg,
      paddingRight: spacing.xs,
      paddingTop: spacing.xs,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    explain: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

    amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    rupee: { fontSize: 28, fontWeight: '700', color: colors.textMuted, marginRight: 6 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: colors.text, paddingVertical: 4 },

    section: { marginTop: spacing.md },
    label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
    input: {
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 42,
      fontSize: 15,
      color: colors.text,
    },
    dateContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dateRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 40,
    },
    dateText: { fontSize: 14, color: colors.text, fontWeight: '500' },
    quickChip: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.chip,
    },
    quickChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    error: { color: colors.expense, fontSize: 12, marginTop: 4 },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    saveText: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 42,
      marginTop: spacing.xs,
    },
    deleteText: { color: colors.expense, fontSize: 14, fontWeight: '600' },
  });

