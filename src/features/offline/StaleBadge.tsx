import React, { useSyncExternalStore } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/**
 * true כשיש שאילתה פעילה שיש לה נתונים שמורים והניסיון האחרון לרענן אותם נכשל
 * (כבר אחרי הכישלון הראשון, בלי לחכות לכל הניסיונות החוזרים).
 */
export function useShowingCachedData(): boolean {
  const qc = useQueryClient();
  return useSyncExternalStore(
    (notify) => qc.getQueryCache().subscribe(notify),
    () =>
      qc.getQueryCache().getAll().some(
        (q) => q.getObserversCount() > 0 && q.state.data !== undefined && (q.state.status === 'error' || q.state.fetchFailureCount > 0),
      ),
  );
}

/** תג קטן בכותרת המסך: "מידע שמור", כשאין חיבור ומוצג מה שנשמר במכשיר. */
export function StaleBadge() {
  const { colors } = useTheme();
  const stale = useShowingCachedData();
  if (!stale) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      accessibilityLabel="מציג מידע שמור, אין חיבור"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
      <Text variant="small" style={{ color: colors.warning, fontWeight: '600' }}>מידע שמור</Text>
    </Animated.View>
  );
}
