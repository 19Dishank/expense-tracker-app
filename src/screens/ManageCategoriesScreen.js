import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryEditModal from '../components/CategoryEditModal';
import { colors, spacing, radius } from '../constants/theme';
import {
  getCategories,
  reorderCategories,
  createOrRestoreCategory,
  getSuggestedCategories,
} from '../db/database';

export default function ManageCategoriesScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await getCategories(db);
      console.log('Categories loaded for management:', rows.length);
      setCategories(rows);
      const sugg = await getSuggestedCategories(db);
      console.log('Suggested categories loaded:', sugg.length);
      setSuggested(sugg);
    } catch (e) {
      console.log('Manage categories load error:', e.message);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openNew() {
    setEditingCategory(null);
    setModalVisible(true);
  }

  function openEdit(category) {
    setEditingCategory(category);
    setModalVisible(true);
  }

  function handleSaved() {
    setModalVisible(false);
    load();
  }

  // direction: -1 moves up, +1 moves down
  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) {
      return;
    }
    const list = [...categories];
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    setCategories(list); // update the screen immediately
    await reorderCategories(
      db,
      list.map((c) => c.id)
    );
  }

  // Adds a suggested category to the database, then refreshes both lists.
  // If the same category was deleted earlier (archived), it is restored with its old entries.
  async function addSuggested(sugg) {
    console.log('Adding suggested category:', sugg.name);
    await createOrRestoreCategory(db, { name: sugg.name, icon: sugg.icon, color: sugg.color });
    load();
  }

  function renderItem({ item, index }) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: item.color + '1F' }]}>
            <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.arrow}
          onPress={() => move(index, -1)}
          disabled={index === 0}
          accessibilityLabel={`Move ${item.name} up`}
        >
          <MaterialCommunityIcons
            name="chevron-up"
            size={26}
            color={index === 0 ? colors.border : colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.arrow}
          onPress={() => move(index, 1)}
          disabled={index === categories.length - 1}
          accessibilityLabel={`Move ${item.name} down`}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={26}
            color={index === categories.length - 1 ? colors.border : colors.text}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Renders a single row in the "Suggested" section
  function renderSuggestedItem(sugg, idx) {
    return (
      <View key={sugg.name + idx} style={styles.row}>
        <View style={styles.rowMain}>
          <View style={[styles.iconCircle, { backgroundColor: sugg.color + '1F' }]}>
            <MaterialCommunityIcons name={sugg.icon} size={22} color={sugg.color} />
          </View>
          <Text style={[styles.name, { color: colors.textMuted }]} numberOfLines={1}>
            {sugg.name}
          </Text>
        </View>
        {/* "+" button adds the suggested category */}
        <TouchableOpacity
          style={styles.addSuggestedButton}
          onPress={() => addSuggested(sugg)}
          accessibilityLabel={`Add ${sugg.name} category`}
        >
          <MaterialCommunityIcons name="plus" size={22} color={colors.income} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={<Text style={styles.hint}>Tap a category to edit it. Use the arrows to change the order.</Text>}
        ListEmptyComponent={<Text style={styles.hint}>No categories yet. Add one below.</Text>}
        ListFooterComponent={
          suggested.length > 0 ? (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>Suggested categories</Text>
              <Text style={styles.suggestedSubtitle}>Tap + to add any of these to your list.</Text>
              <View style={styles.suggestedList}>
                {suggested.map((s, i) => renderSuggestedItem(s, i))}
              </View>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={openNew} activeOpacity={0.8}>
        <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
        <Text style={styles.addText}>Add category</Text>
      </TouchableOpacity>

      <CategoryEditModal
        visible={modalVisible}
        category={editingCategory}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 96 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    minHeight: 60,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, color: colors.text, marginLeft: spacing.md },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButton: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  addText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // Suggested categories section
  suggestedSection: {
    marginTop: spacing.xl,
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  suggestedSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  suggestedList: {
    gap: spacing.sm,
  },
  addSuggestedButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
