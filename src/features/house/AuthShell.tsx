import React from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/** מעטפת משותפת למסכי התחברות/הרשמה/אונבורדינג: לוגו, כותרת וכרטיס תוכן. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: top + spacing.xl, paddingBottom: bottom + spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xl }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="home" size={36} color={colors.primaryText} />
            </View>
            <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
            {subtitle ? <Text muted style={{ textAlign: 'center' }}>{subtitle}</Text> : null}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ gap: spacing.md }}>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }}>
      <Text variant="small" style={{ color: colors.danger }}>{message}</Text>
    </Animated.View>
  );
}
