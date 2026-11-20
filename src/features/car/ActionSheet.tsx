import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export interface SheetAction {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  title: string;
  /** שורות פרטים (שעות, מטרה, הערות) */
  lines: string[];
  person?: { id: string; name: string };
  recurring?: boolean;
  actions: SheetAction[];
  onClose: () => void;
}

/** גיליון פרטים ופעולות לבלוק בלוח (overlay בתוך המסך, כמו BookingSheet). */
export function ActionSheet({ title, lines, person, recurring, actions, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <>
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="סגירה" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)}
        style={{ position: 'absolute', bottom: 0, start: 0, end: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 1.4, borderTopRightRadius: radius.lg * 1.4, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {person ? <Avatar id={person.id} name={person.name} size={36} /> : null}
          <View style={{ flex: 1 }}>
            <Text variant="heading">{title}</Text>
            {recurring ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="repeat" size={14} color={colors.textMuted} />
                <Text variant="small" muted>שריון חוזר</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
        </View>
        {lines.map((l, i) => <Text key={i} muted={i > 0}>{l}</Text>)}
        <View style={{ gap: spacing.sm }}>
          {actions.map((a) => (
            <Pressable key={a.label}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); a.onPress(); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: pressed ? colors.border : colors.surfaceAlt })}>
              <Ionicons name={a.icon} size={20} color={a.destructive ? colors.danger : colors.primary} />
              <Text variant="label" style={{ color: a.destructive ? colors.danger : colors.text }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </>
  );
}
