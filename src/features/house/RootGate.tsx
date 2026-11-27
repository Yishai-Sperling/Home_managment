import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/ui';
import { useProfile, useSession } from '@/lib/session';
import { useTheme } from '@/theme';
import { usePushRegistration } from '@/features/notifications/usePushRegistration';
import { useReminders } from '@/features/notifications/useReminders';
import { useGeofenceSync } from '@/features/geofence/hooks';

/**
 * שער הניווט: אין session → (auth); יש session אך אין בית נוכחי → onboarding; אחרת → (tabs).
 * onboarding פתוח לכל משתמש מחובר (גם "הוספת בית נוסף"), ו-index.tsx מפנה לפי מצב הבית.
 * מחליף את ה-Stack ב-_layout הראשי.
 */
export function RootGate() {
  const { session, loading } = useSession();
  const profile = useProfile();
  const { colors } = useTheme();
  const waiting = loading || (!!session && profile.isLoading);
  usePushRegistration(!!session && !!profile.data?.current_house_id);
  useReminders(!!session && !!profile.data?.current_house_id);
  useGeofenceSync(!!session && !!profile.data?.current_house_id);

  if (waiting) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const signedIn = !!session;
  const hasHouse = signedIn && !!profile.data?.current_house_id;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasHouse}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="info" />
      </Stack.Protected>
    </Stack>
  );
}
