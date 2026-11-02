import React, { useEffect, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { colors, spacing, radius, CATEGORY_COLORS } from '../constants/theme';
import { ICON_LIST } from '../constants/iconList';
import { confirmDelete } from '../utils/confirm';
import { RESERVED_CATEGORY_NAMES } from '../constants/defaultCategories';
import {
  createOrRestoreCategory,
  findActiveCategoryByName,
  updateCategory,
  archiveOrDeleteCategory,
} from '../db/database';

// category = the category being edited, or null to create a new one
export default function CategoryEditModal({ visible, category, onClose, onSaved }) {
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_LIST[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    confirmDelete(
      'Delete category',
      'If this category has entries, it will be hidden but old history keeps it. If it has no entries, it is removed.',
      async () => {
        const result = await archiveOrDeleteCategory(db, category.id);
        console.log('Category delete result:', result);
        onSaved();
      }
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{category ? 'Edit category' : 'New category'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
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
                      color={selected ? '#FFFFFF' : colors.text}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {filteredIcons.length === 0 && <Text style={styles.empty}>No icons found</Text>}
          </ScrollView>

          {/* Fixed footer so Save is always visible */}
          <View style={styles.footer}>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  previewCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.expense, fontSize: 13, marginTop: spacing.sm },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCellSelected: { backgroundColor: colors.accent },
  empty: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },

  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deleteButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

