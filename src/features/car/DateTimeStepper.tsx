import React from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (d: Date) => d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

function Step({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { colors } = useTheme();
  const btn = (icon: 'add' | 'remove', fn: () => void) => (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); fn(); }}
      hitSlop={6}
      accessibilityLabel={icon === 'add' ? `${label} הוסף` : `${label} הפחת`}
      style={({ pressed }) => ({
        width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
      })}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
      <Text variant="small" muted>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {btn('remove', onMinus)}
        <Text variant="label" style={{ minWidth: 62, textAlign: 'center' }}>{value}</Text>
        {btn('add', onPlus)}
      </View>
    </View>
  );
}

/** בורר תאריך ושעה פשוט עם כפתורי +/- (ללא מודולים נייטיב). שעות בצעדי 1, דקות בצעדי 15. */
export function DateTimeStepper({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const { colors } = useTheme();
  const shift = (ms: number) => onChange(new Date(value.getTime() + ms));
  return (
    <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Step label="יום" value={fmtDate(value)} onMinus={() => shift(-DAY)} onPlus={() => shift(DAY)} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Step label="שעה" value={String(value.getHours()).padStart(2, '0')} onMinus={() => shift(-60 * 60 * 1000)} onPlus={() => shift(60 * 60 * 1000)} />
        <Step label="דקות" value={fmtTime(value).slice(-2)} onMinus={() => shift(-15 * 60 * 1000)} onPlus={() => shift(15 * 60 * 1000)} />
      </View>
    </View>
  );
}
