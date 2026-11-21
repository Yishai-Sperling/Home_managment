import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Input, Text } from '@/components/ui';
import { shoppingCategoryLabels } from '@/lib/labels';
import { radius, spacing, useTheme } from '@/theme';
import type { ShoppingCategory, ShoppingFavorite } from '@/types/database';
import type { FavoritePatch } from './hooks';
import { findFavorite, sortFavorites } from './helpers';

const categories = Object.keys(shoppingCategoryLabels) as ShoppingCategory[];

interface Props {
  favorites: ShoppingFavorite[];
  /** מזהה פריט לעריכה מיידית (לחיצה ארוכה על צ'יפ). */
  initialEditId?: string | null;
  /** הודעת שגיאה מהשרת (למשל כפילות). */
  error?: string | null;
  onClose: () => void;
  onAdd: (v: { name: string; quantity: string | null; category: ShoppingCategory }) => void;
  onUpdate: (p: FavoritePatch) => void;
  onDelete: (id: string) => void;
}

/** גיליון ניהול קניות קבועות, overlay בתוך המסך (לא Modal). */
export function FavoritesSheet({ favorites, initialEditId, error, onClose, onAdd, onUpdate, onDelete }: Props) {
  const { colors } = useTheme();
  const sorted = useMemo(() => sortFavorites(favorites), [favorites]);
  const initial = initialEditId ? favorites.find((f) => f.id === initialEditId) : undefined;
  const [editingId, setEditingId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? '');
  const [category, setCategory] = useState<ShoppingCategory>(initial?.category ?? 'groceries');
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => { setEditingId(null); setName(''); setQuantity(''); setCategory('groceries'); setLocalError(null); };
  const startEdit = (f: ShoppingFavorite) => {
    setEditingId(f.id); setName(f.name); setQuantity(f.quantity ?? ''); setCategory(f.category); setLocalError(null);
  };
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const dup = findFavorite(n, favorites);
    if (dup && dup.id !== editingId) { setLocalError('הפריט כבר קיים ברשימת הקבועים'); return; }
    const q = quantity.trim() || null;
    if (editingId) onUpdate({ id: editingId, name: n, quantity: q, category });
    else onAdd({ name: n, quantity: q, category });
    reset();
  };
  const confirmDelete = (f: ShoppingFavorite) => {
    Alert.alert('מחיקת פריט קבוע', `להסיר את "${f.name}" מהקבועים?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => { onDelete(f.id); if (editingId === f.id) reset(); } },
    ]);
  };
  const shownError = localError ?? error ?? null;

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end', zIndex: 50 }}>
      <Pressable onPress={onClose} accessibilityLabel="סגור" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{
          backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl, maxHeight: '90%',
        }}>
          <Text variant="heading">ניהול קניות קבועות</Text>
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
            {sorted.length === 0 ? (
              <Text muted>אין עדיין פריטים קבועים. הוסיפו למטה.</Text>
            ) : sorted.map((f) => (
              <View key={f.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm,
                borderRadius: radius.md, borderWidth: 1,
                borderColor: editingId === f.id ? colors.primary : colors.border,
              }}>
                <Pressable onPress={() => startEdit(f)} accessibilityRole="button" accessibilityLabel={`עריכת ${f.name}`} style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" style={{ fontWeight: '600' }}>{f.name}</Text>
                  <Text variant="small" muted>
                    {shoppingCategoryLabels[f.category]}{f.quantity ? ` · ${f.quantity}` : ''}
                  </Text>
                </Pressable>
                <Pressable onPress={() => startEdit(f)} hitSlop={8} accessibilityLabel="ערוך" style={{ padding: spacing.xs }}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(f)} hitSlop={8} accessibilityLabel="מחק" style={{ padding: spacing.xs }}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Text variant="label" muted>{editingId ? 'עריכת פריט קבוע' : 'הוספת פריט קבוע'}</Text>
          <Input placeholder="שם" value={name} onChangeText={(t) => { setName(t); setLocalError(null); }} onSubmitEditing={save} returnKeyType="done" />
          <Input placeholder="כמות (אופציונלי)" value={quantity} onChangeText={setQuantity} onSubmitEditing={save} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
            {categories.map((c) => (
              <Chip key={c} label={shoppingCategoryLabels[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
          {shownError ? <Text variant="small" style={{ color: colors.danger }}>{shownError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title={editingId ? 'שמור' : 'הוסף'} onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />
            {editingId ? <Button title="בטל עריכה" variant="secondary" onPress={reset} style={{ flex: 1 }} /> : null}
            <Button title="סגור" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
