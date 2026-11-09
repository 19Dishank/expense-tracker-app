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
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme, useThemedStyles, spacing, radius, CATEGORY_COLORS } from '../constants/theme';
import { ICON_LIST } from '../constants/iconList';
import { useDialog } from '../utils/confirm';
import { RESERVED_CATEGORY_NAMES } from '../constants/defaultCategories';
import AppDialog from './AppDialog';
import { useSheetLayout } from '../utils/useSheetLayout';
import {
  createOrRestoreCategory,
  findActiveCategoryByName,
  updateCategory,
  archiveOrDeleteCategory,
} from '../db/database';

// category = the category being edited, or null to create a new one
export default function CategoryEditModal({ visible, category, onClose, onSaved }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { dialogProps, showConfirm } = useDialog();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_LIST[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  // Fill the form each time the sheet opens
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError('');
    setSearch('');
    setSaving(false);
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    } else {
      setName('');
      // A new category must not look like the built-in "Other" tile, so use a different icon
      // and a random color from the palette
      setIcon('star-outline');
      setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    }
  }, [visible, category]);

  // Icons whose name contains the search text
  const query = search.trim().toLowerCase();
  const filteredIcons = ICON_LIST.filter((n) => n.includes(query));

  async function handleSave() {
    if (saving) {
      return; // ignore a second tap while the first save is still running
    }
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter a category name');
      return;
    }
    // "Other" is built into the dashboard. Editing a category that already has that name is allowed.
    const keepsOwnName = category && category.name.toLowerCase() === trimmed.toLowerCase();
    if (RESERVED_CATEGORY_NAMES.includes(trimmed.toLowerCase()) && !keepsOwnName) {
      setError('"Other" is already built in. Choose a different name.');
      return;
    }
    // No two active categories with the same name
    const duplicate = await findActiveCategoryByName(db, trimmed, category ? category.id : null);
    if (duplicate) {
      setError('A category named "' + duplicate.name + '" already exists');
      return;
    }

    setSaving(true);
    try {
      if (category) {
        await updateCategory(db, category.id, { name: trimmed, icon, color });
        onSaved();
      } else {
        const created = await createOrRestoreCategory(db, { name: trimmed, icon, color });
        onSaved(created);
      }
    } catch (e) {
      console.log('Category save failed:', e);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  }

  function handleDelete() {
    showConfirm(
      'Delete category',
      'If this category has entries, it will be hidden but old history keeps it. If it has no entries, it is removed.',
      async () => {
        const result = await archiveOrDeleteCategory(db, category.id);
        console.log('Category delete result:', result);
        onSaved();
      },
      { icon: 'trash-can-outline', iconColor: colors.expense, actionLabel: 'Delete' }
    );
  }

  return (
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
              <Text style={styles.title}>{category ? 'Edit category' : 'New category'}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleDismiss} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Preview + name */}
            <View style={styles.previewRow}>
              <View style={[styles.previewCircle, { backgroundColor: color + '1F' }]}>
                <MaterialCommunityIcons name={icon} size={28} color={color} />
              </View>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                maxLength={20}
              />
            </View>
            {error !== '' && <Text style={styles.error}>{error}</Text>}

            {/* Color picker */}
            <Text style={styles.label}>Color</Text>
            <View style={styles.wrap}>
              {CATEGORY_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }]}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Color ${c}`}
                >
                  {c === color && <MaterialCommunityIcons name="check" size={22} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Icon picker */}
            <Text style={styles.label}>Icon</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search icons (food, car, home...)"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.wrap}>
              {filteredIcons.map((iconName) => {
                const selected = iconName === icon;
                return (
                  <TouchableOpacity
                    key={iconName}
                    style={[styles.iconCell, selected && styles.iconCellSelected]}
                    onPress={() => setIcon(iconName)}
                    accessibilityLabel={iconName}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={24}
                      color={selected ? colors.accentText : colors.text}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {filteredIcons.length === 0 && <Text style={styles.empty}>No icons found</Text>}
          </ScrollView>

          {/* Fixed footer so Save is always visible */}
          <View style={[styles.footer, { paddingBottom: Math.max(spacing.lg, bottomInset) }]}>
            {category && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} accessibilityLabel="Delete category">
                <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.expense} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>

    {/* Custom confirmation dialog (replaces system Alert) */}
    <AppDialog {...dialogProps} />
  </Modal>
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
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  previewCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 42,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.expense, fontSize: 12, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md, marginBottom: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCellSelected: { backgroundColor: colors.accent },
  empty: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
});
