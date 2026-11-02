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
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { colors, spacing, radius } from '../constants/theme';
import { rupeesToPaise, paiseToRupeesString } from '../utils/money';
import { toDateString, parseDateString, formatDisplayDate } from '../utils/period';
import { confirmDelete } from '../utils/confirm';
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
  const isExpense = type === 'expense';

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [source, setSource] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Remembers if the sheet was already open, so the form is reset only when it OPENS
  const wasVisible = useRef(false);

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
    } else {
      setAmount('');
      setDate(new Date());
      setNote('');
      setCategoryId(presetCategoryId || null);
      setSource('');
    }
  }, [visible, editing, presetCategoryId]);

  // When the preset category changes while the sheet is open (a new category was just created),
  // only switch the selected category. Amount, note and date stay exactly as typed.
  useEffect(() => {
    if (visible && presetCategoryId) {
      setCategoryId(presetCategoryId);
    }
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
    confirmDelete('Delete entry', 'This entry will be removed permanently.', async () => {
      await deleteTransaction(db, editing.id);
      onSaved();
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        {/* Tapping the dark area closes the sheet */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
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
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
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
                placeholderTextColor={colors.border}
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
                        <MaterialCommunityIcons name={cat.icon} size={18} color={cat.color} />
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
                  <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
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
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.text} />
                <Text style={styles.dateText}>{formatDisplayDate(toDateString(date))}</Text>
              </TouchableOpacity>
              <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
                <TouchableOpacity style={styles.sourceChip} onPress={() => pickQuickDate(0)}>
                  <Text style={styles.sourceChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceChip} onPress={() => pickQuickDate(1)}>
                  <Text style={styles.sourceChipText}>Yesterday</Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  rupee: { fontSize: 32, fontWeight: '700', color: colors.textMuted, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', color: colors.text, paddingVertical: spacing.sm },

  section: { marginTop: spacing.lg },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipText: { fontSize: 14, color: colors.text },
  sourceChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  sourceChipSelected: { backgroundColor: colors.accent },
  sourceChipText: { fontSize: 14, color: colors.text },
  sourceChipTextSelected: { color: '#FFFFFF' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  dateText: { fontSize: 16, color: colors.text },
  error: { color: colors.expense, fontSize: 13, marginTop: spacing.sm },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  newCatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  newCatText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  deleteText: { color: colors.expense, fontSize: 15, fontWeight: '600' },
});

