import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { EmptyState, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import type { CarRecurringRule } from '@/types/database';
import { parseISODate, summarizeRule } from './recurrence';

interface Props {
  rules: CarRecurringRule[];
  loading: boolean;
  uid: string | undefined;
  isAdmin: boolean;
  nameOf: (userId: string) => string;
  onEdit: (rule: CarRecurringRule) => void;
  onDelete: (rule: CarRecurringRule) => void;
  onClose: () => void;
}

/** רשימת הסדרות החוזרות של הבית (overlay). עריכה ומחיקה לבעלים או למנהל. */
export function RulesSheet({ rules, loading, uid, isAdmin, nameOf, onEdit, onDelete, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <>
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="סגירה" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)}
        style={{ position: 'absolute', bottom: 0, start: 0, end: 0, maxHeight: 560, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 1.4, borderTopRightRadius: radius.lg * 1.4 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="heading" style={{ flex: 1 }}>שריונים חוזרים</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
          </View>
          {rules.length === 0 ? (
            <EmptyState title={loading ? 'טוען…' : 'אין שריונים חוזרים'} hint={loading ? undefined : 'בעת שריון הפעילו "חוזר" כדי ליצור סדרה'} />
          ) : null}
          {rules.map((r) => {
            const canEdit = r.user_id === uid || isAdmin;
            const name = nameOf(r.user_id);
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
                <Avatar id={r.user_id} name={name} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{name}</Text>
                  <Text>{summarizeRule(r)}</Text>
                  {r.purpose ? <Text variant="small" muted>{r.purpose}</Text> : null}
                  {r.ends_on ? <Text variant="small" muted>עד {parseISODate(r.ends_on).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })}</Text> : null}
                </View>
                {canEdit ? (
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <Pressable accessibilityLabel="ערוך סדרה" hitSlop={8} onPress={() => onEdit(r)} style={{ padding: spacing.sm }}>
                      <Ionicons name="create-outline" size={22} color={colors.primary} />
                    </Pressable>
                    <Pressable accessibilityLabel="מחק סדרה" hitSlop={8} onPress={() => onDelete(r)} style={{ padding: spacing.sm }}>
                      <Ionicons name="trash-outline" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  );
}
