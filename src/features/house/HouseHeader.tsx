import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { StaleBadge } from '@/features/offline/StaleBadge';
import { radius, spacing, useTheme } from '@/theme';
import { useCurrentHouse, useHouses, useSwitchHouse } from './hooks';

function IconButton({ name, onPress, label }: { name: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={name} size={20} color={colors.text} />
    </Pressable>
  );
}

/**
 * כותרת למסכי הטאבים: שם הבית הנוכחי (לחיצה פותחת בורר בתים + הוספת בית),
 * וכפתור דיירים/הגדרות. שימוש: <HouseHeader title="קניות" /> — title אופציונלי (כותרת המסך מתחת לשם הבית).
 */
export function HouseHeader({ title }: { title?: string }) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { house } = useCurrentHouse();
  const houses = useHouses();
  const switchHouse = useSwitchHouse();
  const [open, setOpen] = useState(false);

  const pick = (id: string) => {
    if (id !== house?.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      switchHouse.mutate(id);
    }
    setOpen(false);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md }}>
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen(true); }}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1, gap: 2 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant={title ? 'label' : 'title'} muted={!!title} numberOfLines={1} style={{ flexShrink: 1 }}>{house?.name ?? 'הבית שלי'}</Text>
          <Ionicons name="chevron-down" size={title ? 14 : 20} color={colors.textMuted} />
        </View>
        {title ? <Text variant="title">{title}</Text> : null}
      </Pressable>
      <StaleBadge />
      <IconButton name="people" label="דיירים והגדרות" onPress={() => router.push('/settings')} />

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="סגירה" />
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 1.4, borderTopRightRadius: radius.lg * 1.4, padding: spacing.lg, paddingBottom: bottom + spacing.lg, gap: spacing.sm }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm }} />
            <Text variant="heading" style={{ marginBottom: spacing.xs }}>הבתים שלי</Text>
            {(houses.data ?? []).map((h) => {
              const active = h.id === house?.id;
              return (
                <Pressable key={h.id} onPress={() => pick(h.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent' })}>
                  <Ionicons name="home" size={20} color={active ? colors.primary : colors.textMuted} />
                  <Text style={{ flex: 1, fontWeight: active ? '700' : '400' }}>{h.name}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => { setOpen(false); router.push('/onboarding'); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>הוסף בית / הצטרף לבית</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}
