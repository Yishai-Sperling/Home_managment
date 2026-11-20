import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Input, Text } from '@/components/ui';
import { shoppingCategoryLabels } from '@/lib/labels';
import { radius, spacing, useTheme } from '@/theme';
import type { ShoppingCategory, ShoppingItem } from '@/types/database';
import type { ItemPatch } from './hooks';

const categories = Object.keys(shoppingCategoryLabels) as ShoppingCategory[];

/** גיליון עריכת פריט, overlay בתוך המסך (לא Modal). */
export function ItemEditSheet({ item, onClose, onSave }: { item: ShoppingItem; onClose: () => void; onSave: (p: ItemPatch) => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [category, setCategory] = useState<ShoppingCategory>(item.category);
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: item.id, name: name.trim(), quantity: quantity.trim() || null, category });
  };
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end', zIndex: 50 }}>
      <Pressable onPress={onClose} accessibilityLabel="סגור" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{
          backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl,
        }}>
          <Text variant="heading">עריכת פריט</Text>
          <Input label="שם" value={name} onChangeText={setName} onSubmitEditing={save} returnKeyType="done" autoFocus />
          <Input label="כמות" placeholder="אופציונלי" value={quantity} onChangeText={setQuantity} onSubmitEditing={save} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
            {categories.map((c) => (
              <Chip key={c} label={shoppingCategoryLabels[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="שמור" onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
