import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
import { Card, Chip, Text } from '@/components/ui';
import { useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';
import type { PresenceStatus } from '@/types/database';
import { ETA_OPTIONS, effectivePresence, etaFromNow, presenceText, sortByPresence } from './helpers';
import { useMembersPresence, useSetPresence } from './hooks';

const SEGMENTS: { key: 'home' | 'away' | 'soon'; label: string }[] = [
  { key: 'home', label: 'בבית' },
  { key: 'away', label: 'בחוץ' },
  { key: 'soon', label: 'חוזר עוד…' },
];

export function WhoIsHomeCard() {
  const { colors } = useTheme();
  const { session } = useSession();
  const uid = session?.user.id;
  const { data } = useMembersPresence();
  const set = useSetPresence();
  const [pickingEta, setPickingEta] = useState(false);

  const dot: Record<string, string> = { home: colors.success, away: '#9CA3AF', soon: colors.warning };
  const now = new Date();
  const members = sortByPresence(data ?? [], now);
  const mine = members.find((m) => m.user_id === uid);
  const myStatus = mine ? effectivePresence(mine, now) : null;

  const apply = (status: PresenceStatus | null, eta?: string | null) => {
    set.mutate({ status, eta }, {
      onError: () => Alert.alert('שגיאה', 'לא הצלחנו לעדכן את הסטטוס. נסו שוב.'),
    });
  };

  const choose = (key: 'home' | 'away' | 'soon') => {
    Haptics.selectionAsync().catch(() => {});
    if (key === 'soon') {
      if (myStatus === 'soon' && !pickingEta) { apply(null); return; }
      setPickingEta((v) => !v);
      return;
    }
    setPickingEta(false);
    apply(myStatus === key ? null : key);
  };

  const pickEta = (minutes: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPickingEta(false);
    apply('soon', etaFromNow(minutes));
  };

  if (!data || data.length === 0) return null;
  const showSoonActive = pickingEta || myStatus === 'soon';

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="heading">מי בבית</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        {members.map((m) => {
          const s = effectivePresence(m, now);
          const name = m.profile?.full_name ?? 'דייר';
          return (
            <View key={m.user_id} style={{ alignItems: 'center', width: 68, gap: 2, opacity: s ? 1 : 0.55 }}>
              <View>
                <Avatar name={name} id={m.user_id} size={44} />
                <View style={{
                  position: 'absolute', end: -2, bottom: -2, width: 14, height: 14, borderRadius: 7,
                  backgroundColor: s ? dot[s] : colors.surfaceAlt, borderWidth: 2, borderColor: colors.surface,
                }} />
              </View>
              <Text variant="small" style={{ fontWeight: '600' }} numberOfLines={1}>{name.trim().split(/\s+/)[0]}</Text>
              <Text variant="small" muted numberOfLines={1} style={{ fontSize: 11 }}>{presenceText(m, now)}</Text>
            </View>
          );
        })}
      </View>

      {mine ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
            {SEGMENTS.map((seg) => {
              const selected = seg.key === 'soon' ? showSoonActive : myStatus === seg.key;
              return (
                <Pressable key={seg.key} onPress={() => choose(seg.key)}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: radius.md - 3, alignItems: 'center', backgroundColor: selected ? colors.primary : 'transparent' }}>
                  <Text variant="label" style={{ color: selected ? colors.primaryText : colors.text }}>{seg.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {pickingEta ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {ETA_OPTIONS.map((o) => <Chip key={o.minutes} label={o.label} onPress={() => pickEta(o.minutes)} />)}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
