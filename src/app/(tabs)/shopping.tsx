import { HouseHeader } from '@/features/house';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useListMotion, type ListMotion } from '@/theme/motion';
import { uuid } from '@/lib/uuid';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, EmptyState, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { shoppingCategoryLabels, shoppingStatusLabels } from '@/lib/labels';
import { useCurrentHouseId } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';
import type { ShoppingCategory, ShoppingItem } from '@/types/database';
import {
  useAddItem, useClearBought, useDeleteItem, useMemberNames, useShoppingHistory, useShoppingItems,
  useToggleBought, useUpdateItem, type ShoppingFilter,
} from '@/features/shopping/hooks';
import { flatRows, groupByCategory, suggestNames, type ShoppingRow } from '@/features/shopping/helpers';
import { ItemEditSheet } from '@/features/shopping/ItemEditSheet';

const categories = Object.keys(shoppingCategoryLabels) as ShoppingCategory[];
const categoryIcon: Record<ShoppingCategory, keyof typeof Ionicons.glyphMap> = {
  groceries: 'nutrition-outline', cleaning: 'sparkles-outline', pharmacy: 'medkit-outline', other: 'pricetag-outline',
};
const filters: { key: ShoppingFilter; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'pending', label: shoppingStatusLabels.pending },
  { key: 'bought', label: shoppingStatusLabels.bought },
];

function ItemRow({ item, motion, adderName, onToggle, onEdit, onDelete }: {
  item: ShoppingItem; motion: ListMotion; adderName: string | undefined; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { colors } = useTheme();
  const bought = item.status === 'bought';
  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('מחיקת פריט', `למחוק את "${item.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: onDelete },
    ]);
  };
  return (
    <Animated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface,
        borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
        opacity: bought ? 0.65 : 1,
      }}>
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityLabel={item.name}
          accessibilityState={{ checked: bought }}
          style={{
            width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
            borderColor: bought ? colors.success : colors.border, backgroundColor: bought ? colors.success : 'transparent',
          }}>
          {bought ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
        </Pressable>
        <Pressable onPress={onEdit} onLongPress={confirmDelete} accessibilityRole="button" accessibilityLabel={`עריכת ${item.name}`} style={{ flex: 1, gap: 2 }}>
          <Text variant="body" style={{ fontWeight: '600', textDecorationLine: bought ? 'line-through' : 'none' }}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name={categoryIcon[item.category]} size={14} color={colors.textMuted} />
            <Text variant="small" muted>
              {shoppingCategoryLabels[item.category]}{item.quantity ? ` · ${item.quantity}` : ''}
            </Text>
          </View>
        </Pressable>
        <Avatar name={adderName} id={item.added_by || item.id} size={24} />
        <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="מחק" style={{ padding: spacing.xs }}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function ShoppingScreen() {
  const pad = useScreenPadding();
  const houseId = useCurrentHouseId();
  const [filter, setFilter] = useState<ShoppingFilter>('all');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<ShoppingCategory>('groceries');

  const { data: items, isLoading, error, refetch, isRefetching } = useShoppingItems(houseId, filter);
  const motion = useListMotion(!isLoading);
  const add = useAddItem();
  const toggle = useToggleBought();
  const del = useDeleteItem();
  const update = useUpdateItem();
  const clearBought = useClearBought();
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const { data: boughtItems } = useShoppingItems(houseId, 'bought');
  const { data: history } = useShoppingHistory(houseId);
  const { data: names } = useMemberNames(houseId);
  const hasBought = (boughtItems?.length ?? 0) > 0;
  const suggestions = useMemo(() => suggestNames(history ?? [], name), [history, name]);
  const rows: ShoppingRow[] = useMemo(
    () => (filter === 'bought' ? flatRows(items ?? []) : groupByCategory(items ?? [])),
    [items, filter],
  );

  const confirmClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('ניקוי רשימה', 'למחוק את כל הפריטים שנקנו?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'נקה', style: 'destructive', onPress: () => clearBought.mutate() },
    ]);
  };

  const submit = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    add.mutate({ id: uuid(), name, quantity, category });
    setName('');
    setQuantity('');
  };

  return (
    <Screen style={pad}>
      <HouseHeader />
      <Text variant="title" style={{ marginBottom: spacing.md }}>קניות</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl * 2 }}
        refreshing={isRefetching}
        onRefresh={() => { refetch(); }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <Card style={{ gap: spacing.md }}>
              <Input placeholder="מה צריך לקנות?" value={name} onChangeText={setName} onSubmitEditing={submit} returnKeyType="done" />
              {suggestions.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
                  {suggestions.map((sg) => (
                    <Chip key={sg.name} label={sg.name} onPress={() => { setName(sg.name); setCategory(sg.category); }} />
                  ))}
                </ScrollView>
              ) : null}
              <Input placeholder="כמות (אופציונלי)" value={quantity} onChangeText={setQuantity} onSubmitEditing={submit} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {categories.map((c) => (
                  <Chip key={c} label={shoppingCategoryLabels[c]} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>
              <Button title="הוסף לרשימה" onPress={submit} disabled={!name.trim() || !houseId} />
              {add.isError ? <Text variant="small" style={{ color: '#DC2626' }}>ההוספה נכשלה, נסו שוב</Text> : null}
            </Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {filters.map((f) => (
                <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
              ))}
            </View>
            {hasBought ? (
              <Button title="נקה את מה שנקנה" variant="secondary" onPress={confirmClear} loading={clearBought.isPending} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>טוען…</Text>
            : error ? <EmptyState title="שגיאה בטעינה" hint="משכו למטה כדי לנסות שוב" />
            : <EmptyState title="הרשימה ריקה" hint="הוסיפו את הפריט הראשון למעלה" />
        }
        renderItem={({ item: row }) => row.type === 'header' ? (
          <Text variant="label" muted style={{ marginTop: spacing.sm }}>{shoppingCategoryLabels[row.category]}</Text>
        ) : (
          <ItemRow
            motion={motion}
            item={row.item}
            adderName={names?.[row.item.added_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              toggle.mutate(row.item);
            }}
            onDelete={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              del.mutate(row.item.id);
            }}
          />
        )}
      />
      {editing ? (
        <ItemEditSheet
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => { update.mutate(p); setEditing(null); }}
        />
      ) : null}
    </Screen>
  );
}
