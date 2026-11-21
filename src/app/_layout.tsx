import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { RootGate } from '@/features/house/RootGate';
import { StatusBar } from 'expo-status-bar';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StaleBanner } from '@/features/offline/StaleBanner';
import { CACHE_BUSTER, CACHE_MAX_AGE_MS, shouldPersistQuery } from '@/lib/cachePolicy';
import { persister, queryClient } from '@/lib/queryClient';
import { ensureRTL } from '@/lib/rtl';
import { SessionProvider } from '@/lib/session';
import { useTheme } from '@/theme';

ensureRTL();

export default function RootLayout() {
  const { colors } = useTheme();

  // חזרה לאפליקציה מרעננת את הנתונים (וכך גם מנקה את "מציג מידע שמור" כשחזר החיבור)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: CACHE_MAX_AGE_MS,
            buster: CACHE_BUSTER,
            dehydrateOptions: { shouldDehydrateQuery: (q) => shouldPersistQuery(q.queryKey, q.state.status) },
          }}>
          <SessionProvider>
            <StatusBar style="auto" />
            <RootGate />
            <StaleBanner />
          </SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
