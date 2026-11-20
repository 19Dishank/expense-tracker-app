import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';
import { formatINR } from '../utils/money';
import { useDialog } from '../utils/confirm';
import AppDialog from '../components/AppDialog';
import { useSheetLayout } from '../utils/useSheetLayout';
import {
  getQuickExpenses,
  addQuickExpense,
  updateQuickExpense,
  deleteQuickExpense,
  getCategories,
} from '../db/database';

// Standard fallback category for "Other"
const OTHER_CATEGORY = {
  id: 'other',
  name: 'Other',
  icon: 'dots-horizontal-circle-outline',
  color: '#8C8C8C',
};

export default function ManageQuickExpensesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm } = useDialog();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  // null = sheet closed, {} = new, { id, label, ... } = editing
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const [qs, cats] = await Promise.all([getQuickExpenses(db), getCategories(db)]);
      setItems(qs);
      setCategories(cats);
    } catch (e) {
      console.log('Quick expenses load error:', e.message);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleAdd() {
    setEditing({});
  }

  function handleEdit(item) {
    setEditing(item);
  }

  function handleDelete(item) {
    showConfirm(
      'Delete quick expense',
      `Delete "${item.label}"? This only removes the template — past entries are kept.`,
      async () => {
        await deleteQuickExpense(db, item.id);
        load();
      },
      { icon: 'trash-can-outline', iconColor: colors.expense, actionLabel: 'Delete' }
    );
  }

  async function handleSaved() {
    setEditing(null);
    await load();
  }

  function renderItem({ item }) {
    const iconName = item.category_icon || OTHER_CATEGORY.icon;
    const iconColor = item.category_color || OTHER_CATEGORY.color;
    return (
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '1F' }]}>
          <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {formatINR(item.amount)}
            {item.category_name ? ` · ${item.category_name}` : ' · Other'}
            {item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleDelete(item)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No quick expenses yet.{'\n'}Tap the + button to add your first recurring expense.
          </Text>
        }
        ListFooterComponent={<View style={{ height: spacing.xxl }} />}
      />

      {/* Floating add button */}
      <TouchableOpacity style={styles.fab} onPress={handleAdd} activeOpacity={0.8}>
        <MaterialCommunityIcons name="plus" size={28} color={colors.onColor} />
      </TouchableOpacity>

      {/* Edit / add sheet */}
      <QuickExpenseSheet
        visible={editing !== null}
        item={editing || {}}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <AppDialog {...dialogProps} />
    </View>
  );
}

// ─── Bottom sheet for add / edit ───────────────────────────────────────────────

function QuickExpenseSheet({ visible, item, categories, onClose, onSaved }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // All categories including the virtual Other
  const allCategories = [...categories, OTHER_CATEGORY];

  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const { maxSheetHeight, bottomInset } = useSheetLayout();
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible]);

  // Reset form every time the sheet opens
  useEffect(() => {
    if (!visible) return;
    setError('');
    setSaving(false);
    if (item && item.id) {
      // Editing
      setLabel(item.label || '');
      // Convert paise to rupees string
      const paise = item.amount || 0;
      const rupees = Math.floor(paise / 100);
      const cents = paise % 100;
      setAmountText(cents === 0 ? String(rupees) : `${rupees}.${String(cents).padStart(2, '0')}`);
      setCategoryId(item.category_id || null);
      setNote(item.note || '');
    } else {
      setLabel('');
      setAmountText('');
      setCategoryId(null);
      setNote('');
    }
  }, [visible, item]);

  function handleDismiss() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setModalVisible(false);
      onClose();
    });
  }

  async function handleSave() {
    if (saving) return;
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Enter a name for this quick expense');
      return;
    }
    // Parse amount
    const cleaned = amountText.replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || parseFloat(cleaned) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const paise = Math.round(parseFloat(cleaned) * 100);
    if (paise <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const data = { label: trimmedLabel, amount: paise, categoryId: categoryId || null, note: note.trim() || null };
      if (item && item.id) {
        await updateQuickExpense(db, item.id, data);
      } else {
        await addQuickExpense(db, data);
      }
      onSaved();
    } catch (e) {
      console.log('Quick expense save error:', e.message);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  }

  const isEditing = !!(item && item.id);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropTap} onPress={handleDismiss} />
        </Animated.View>

        <KeyboardAvoidingView style={styles.keyboardAvoid} behavior="padding" pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { maxHeight: maxSheetHeight, transform: [{ translateY: sheetTranslateY }] }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{isEditing ? 'Edit quick expense' : 'New quick expense'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable form */}
            <View style={styles.formScroll}>
              {/* Label */}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. SIP Investment"
                placeholderTextColor={colors.textMuted}
                autoFocus={!isEditing}
                maxLength={30}
              />

              {/* Amount */}
              <Text style={styles.fieldLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={amountText}
                onChangeText={setAmountText}
                placeholder="e.g. 5000"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              {/* Note (optional) */}
              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Zerodha, MF"
                placeholderTextColor={colors.textMuted}
                maxLength={50}
              />

              {/* Category chooser */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.catWrap}>
                {allCategories.map((cat) => {
                  const sel = String(categoryId) === String(cat.id) || (cat.id === 'other' && !categoryId);
                  return (
                    <TouchableOpacity
                      key={String(cat.id)}
                      style={[styles.catChip, sel && { backgroundColor: cat.color + '33', borderColor: cat.color, borderWidth: 1 }]}
                      onPress={() => setCategoryId(cat.id === 'other' ? null : cat.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name={cat.icon} size={15} color={sel ? cat.color : colors.textMuted} />
                      <Text style={[styles.catChipText, sel && { color: cat.color }]} numberOfLines={1}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error !== '' && <Text style={styles.error}>{error}</Text>}
            </View>

            {/* Footer */}
            <View style={[styles.sheetFooter, { paddingBottom: Math.max(spacing.lg, bottomInset) }]}>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 60 },
    empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, lineHeight: 22 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.expense,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },

    // Sheet styles
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
    backdropTap: { flex: 1 },
    keyboardAvoid: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: spacing.lg,
      paddingRight: spacing.xs,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

    formScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md, marginBottom: 4 },
    input: {
      backgroundColor: colors.chip,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      fontSize: 15,
      color: colors.text,
    },

    catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.chip,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    catChipText: { fontSize: 12, color: colors.textMuted },

    error: { color: colors.expense, fontSize: 12, marginTop: spacing.sm },

    sheetFooter: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
  });
