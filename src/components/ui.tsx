import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type TextInputProps, type TextProps, type ViewProps, type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme, font } from '@/theme';

/** תקרה לגודל הפונט כשהמשתמש מגדיל את הטקסט במערכת, כדי שהפריסה לא תישבר (עדיין גדול יותר מהרגיל). */
export const MAX_FONT_SCALE = 1.3;

type Variant = keyof typeof font;

export function Text({ variant = 'body', muted, style, ...p }: TextProps & { variant?: Variant; muted?: boolean }) {
  const { colors } = useTheme();
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...p} style={[font[variant], { color: muted ? colors.textMuted : colors.text }, style]} />;
}

export function Screen({ children, style, ...p }: ViewProps) {
  const { colors } = useTheme();
  return <View {...p} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

export function Card({ style, ...p }: ViewProps) {
  const { colors } = useTheme();
  return <View {...p} style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, style]} />;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, ...p }:
  Omit<PressableProps, 'style'> & { title: string; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, danger: colors.danger, ghost: 'transparent' }[variant];
  const fg = { primary: colors.primaryText, secondary: colors.primary, danger: '#fff', ghost: colors.primary }[variant];
  return (
    <Pressable
      {...p}
      disabled={disabled || loading}
      onPress={(e) => { Haptics.selectionAsync().catch(() => {}); onPress?.(e); }}
      style={({ pressed }) => [{ backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</RNText>}
    </Pressable>
  );
}

export function Input({ label, style, ...p }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text variant="label" muted>{label}</Text> : null}
      <TextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        placeholderTextColor={colors.textMuted}
        {...p}
        style={[{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12, fontSize: 16 }, style]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: selected ? colors.primary : colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
      <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: selected ? colors.primaryText : colors.text, fontWeight: '600', fontSize: 14 }}>{label}</RNText>
    </Pressable>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {hint ? <Text muted style={{ textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

export function useScreenPadding() {
  const { top } = useSafeAreaInsets();
  return { paddingTop: top + spacing.md, paddingHorizontal: spacing.lg };
}
