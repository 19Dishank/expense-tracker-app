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
  Switch,
  Animated,
  Dimensions,
  Easing,
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
import { useSheetLayout } from '../utils/useSheetLayout';
import { addTransaction, updateTransaction, deleteTransaction } from '../db/database';

// Standard fallback category for "Other"
const OTHER_CATEGORY = {
  id: 'other',
  name: 'Other',
  icon: 'dots-horizontal-circle-outline',
  color: '#8C8C8C',
};

export default function AddTransactionModal({
  visible,
  type, // 'expense' or 'income'
  categories, // active categories for the chooser
  incomeSources, // previously used income sources (array of text)
  presetCategoryId, // category chosen by tapping it on the dashboard (or null)
  editing, // the entry being edited (or null when adding)
  onClose,
  onSaved,
  onAddNewCategory, // opens category creator from inside this drawer
}) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isExpense = type === 'expense';
  const { dialogProps, showConfirm } = useDialog();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [source, setSource] = useState('');
  const [paidInCash, setPaidInCash] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Remembers if the sheet was already open, so the form is reset only when it OPENS
  const wasVisible = useRef(false);

  // Screen height for the bottom-sheet slide animation
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const { maxSheetHeight, bottomInset } = useSheetLayout();

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
      ]).start(({ finished }) => {
        // Skip when the sheet was opened again before it finished closing
        if (finished) {
          setModalVisible(false);
        }
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
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setModalVisible(false);
      onClose();
    });
  }

  // Every time the sheet opens, fill the fields (edit mode) or clear them (add mode)
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) {
      return; // already open: do not wipe what the user has typed
    }
    wasVisible.current = true;
    setErrors({});
    setShowPicker(false);
    setSaving(false);
    if (editing) {
      setAmount(paiseToRupeesString(editing.amount));
      setDate(parseDateString(editing.date));
      setNote(editing.note || '');
      setCategoryId(editing.category_id ? editing.category_id : 'other');
      setSource(editing.source || '');
      setPaidInCash(!!editing.paid_in_cash);
    } else {
      setAmount('');
      setDate(new Date());
      setNote('');
      setCategoryId(presetCategoryId || null);
      setSource('');
      setPaidInCash(false);
    }
  }, [visible, editing, presetCategoryId]);

  // When the preset category changes while the sheet is open (a new category was just created),
  // only switch the selected category. Amount, note and date stay exactly as typed.
  // Note: `visible` is intentionally omitted from deps — we only want to react to presetCategoryId
  // changes (not to the sheet opening/closing), so we guard manually with the visible check.
  useEffect(() => {
    if (visible && presetCategoryId) {
      setCategoryId(presetCategoryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCategoryId]);

  // If we edit an entry whose category was archived, keep that category in the chooser
  let chooserList = categories;
  if (
    editing &&
    isExpense &&
    editing.category_id &&
    !categories.some((c) => c.id === editing.category_id)
  ) {
    chooserList = [
      {
        id: editing.category_id,
        name: editing.category_name,
        icon: editing.category_icon,
        color: editing.category_color,
      },
      ...categories,
    ];
  }

  // Include Other in the category chooser if not already present
  if (isExpense && !chooserList.some((c) => c.id === 'other' || c.name.toLowerCase() === 'other')) {
    chooserList = [...chooserList, OTHER_CATEGORY];
  }

  const presetCategory =
    presetCategoryId === 'other'
      ? OTHER_CATEGORY
      : categories.find((c) => c.id === presetCategoryId);
  // The chooser is hidden when the user came by tapping a category
  const showChooser = isExpense && !presetCategoryId;

  let title = isExpense ? 'Add expense' : 'Add income';
  if (editing) {
    title = isExpense ? 'Edit expense' : 'Edit income';
  } else if (presetCategory) {
    title = presetCategory.name;
  }

  function pickQuickDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(d);
  }

  async function handleSave() {
    const newErrors = {};
    const paise = rupeesToPaise(amount);
    if (paise === null) {
      newErrors.amount = 'Enter an amount from 0.01 up to 9,99,99,999';
    }
    if (isExpense && !categoryId) {
      newErrors.category = 'Choose a category';
    }
    if (!isExpense && source.trim() === '') {
      newErrors.source = 'Enter where this income came from';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // categoryId === 'other' means uncategorised in DB (category_id is NULL)
    const finalCatId = categoryId === 'other' ? null : categoryId;

    const data = {
      type,
      amount: paise,
      categoryId: isExpense ? finalCatId : null,
      source: isExpense ? null : source.trim(),
      note: note.trim() === '' ? null : note.trim(),
      date: toDateString(date),
      paidInCash: isExpense && paidInCash,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(db, editing.id, data);
      } else {
        await addTransaction(db, data);
      }
      onSaved();
    } catch (e) {
      console.log('Save failed:', e);
      setErrors({ general: 'Could not save. Please try again.' });
      setSaving(false);
    }
  }

  function handleDelete() {
    showConfirm(
      'Delete entry',
      'This entry will be removed permanently.',
      async () => {
        await deleteTransaction(db, editing.id);
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
          behavior="padding"
          pointerEvents="box-none"
        >
          {/* Animated bottom sheet: slides up from bottom */}
          <Animated.View style={[styles.sheet, { maxHeight: maxSheetHeight, transform: [{ translateY: sheetTranslateY }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {presetCategory && !editing && (
                  <View style={[styles.headerIcon, { backgroundColor: presetCategory.color + '1F' }]}>
                    <MaterialCommunityIcons name={presetCategory.icon} size={20} color={presetCategory.color} />
                  </View>
                )}
                <Text style={styles.title}>{title}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleDismiss} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(spacing.lg, bottomInset) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                autoFocus
                maxLength={13}
              />
            </View>
            {errors.amount && <Text style={styles.error}>{errors.amount}</Text>}

            {/* Category chooser (expense without a preset category) */}
            {showChooser && (
              <View style={styles.section}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chipWrap}>
                  {chooserList.map((cat) => {
                    const selected = cat.id === categoryId;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catChip,
                          selected && { backgroundColor: cat.color + '1F', borderColor: cat.color },
                        ]}
                        onPress={() => setCategoryId(cat.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name={cat.icon} size={16} color={cat.color} />
                        <Text style={styles.catChipText}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.category && <Text style={styles.error}>{errors.category}</Text>}
              </View>
            )}

            {/* Source (income) */}
            {!isExpense && (
              <View style={styles.section}>
                <Text style={styles.label}>Source</Text>
                <TextInput
                  style={styles.input}
                  value={source}
                  onChangeText={setSource}
                  placeholder="Salary, Freelance, Gift..."
                  placeholderTextColor={colors.textMuted}
                  maxLength={30}
                />
                {incomeSources.length > 0 && (
                  <View style={[styles.chipWrap, { marginTop: spacing.xs }]}>
                    {incomeSources.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.sourceChip, s === source && styles.sourceChipSelected]}
                        onPress={() => setSource(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sourceChipText, s === source && styles.sourceChipTextSelected]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {errors.source && <Text style={styles.error}>{errors.source}</Text>}
              </View>
            )}

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
                    // On Android the dialog closes itself; hide our flag too
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
                placeholder="Add a note"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
            </View>

            {/* Paid in cash toggle (expenses only) */}
            {isExpense && (
              <View style={[styles.section, styles.cashRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cashTitle}>Paid in cash</Text>
                  <Text style={styles.cashSub}>Counts against your cash in wallet</Text>
                </View>
                <Switch
                  value={paidInCash}
                  onValueChange={setPaidInCash}
                  trackColor={{ false: colors.border, true: colors.income }}
                  thumbColor={paidInCash ? colors.onColor : colors.textMuted}
                />
              </View>
            )}

            {errors.general && <Text style={styles.error}>{errors.general}</Text>}

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveText}>{editing ? 'Save changes' : 'Save'}</Text>
            </TouchableOpacity>

            {/* "+ Add new category" option — rendered only when opened from the "Other" category tile */}
            {isExpense && onAddNewCategory && categoryId === 'other' && (
              <TouchableOpacity
                style={styles.newCatButton}
                onPress={onAddNewCategory}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.accent} />
                <Text style={styles.newCatText}>Add new category</Text>
              </TouchableOpacity>
            )}

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

  {/* Custom delete confirmation dialog (replaces system Alert) */}
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
  headerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  sourceChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  sourceChipSelected: { backgroundColor: colors.accent },
  sourceChipText: { fontSize: 13, color: colors.text },
  sourceChipTextSelected: { color: colors.accentText },

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

  cashRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  cashTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cashSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
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
  newCatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 42,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  newCatText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
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

