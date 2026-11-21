import React, { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/** true כשיש שאילתה פעילה שהרענון האחרון שלה נכשל אבל יש לה נתונים שמורים להצגה. */
function useShowingCachedData(): boolean {
  const qc = useQueryClient();
  return useSyncExternalStore(
    (notify) => qc.getQueryCache().subscribe(notify),
    () => qc.getQueryCache().getAll().some((q) => q.getObserversCount() > 0 && q.state.status === 'error' && q.state.data !== undefined),
  );
}

/** פס קטן בראש המסך: "מציג מידע שמור", כשאין חיבור ואפשר רק להציג את מה שנשמר. */
export function StaleBanner() {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const stale = useShowingCachedData();
  if (!stale) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: top + spacing.xs, start: 0, end: 0, alignItems: 'center' }}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1, borderColor: colors.warning }}>
        <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
        <Text variant="small" style={{ color: colors.warning, fontWeight: '600' }}>מציג מידע שמור · אין חיבור</Text>
      </Animated.View>
    </View>
  );
}
