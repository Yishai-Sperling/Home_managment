import React from 'react';
import { RootGate } from '@/features/house/RootGate';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureRTL } from '@/lib/rtl';
import { SessionProvider } from '@/lib/session';

ensureRTL();
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="auto" />
            <RootGate />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
