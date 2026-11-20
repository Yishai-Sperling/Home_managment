import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import type { CarReservation } from '@/types/database';
import { blockRect, DAY_MINUTES, isSameDay, nowOffset, startOfDay } from './timeline';

export const HOUR_HEIGHT = 60;
const LABEL_W = 48;
const hh = (iso: string | Date) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

export interface Draft { start: Date; end: Date; conflict: boolean }

interface Props {
  day: Date;
  now: Date;
  reservations: CarReservation[];
  draft: Draft | null;
  uid: string | undefined;
  nameOf: (userId: string) => string;
  /** עולה בכל לחיצה על "עכשיו" כדי לגלול אל הקו הכחול */
  scrollSignal: number;
  onSlotPress: (at: Date) => void;
  onBlockPress: (r: CarReservation) => void;
}

/** לוח יום: ציר שעות אנכי, בלוק לכל שריון, וקו כחול של "עכשיו" שמתעדכן עם `now`. */
export function DayTimeline({ day, now, reservations, draft, uid, nameOf, scrollSignal, onSlotPress, onBlockPress }: Props) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const nowTop = nowOffset(now, day, HOUR_HEIGHT);
  const isToday = isSameDay(now, day);
  const draftRect = draft ? blockRect({ starts_at: draft.start.toISOString(), ends_at: draft.end.toISOString() }, day, HOUR_HEIGHT) : null;

  // גלילה ל"עכשיו" (או ל-08:00 ביום אחר) בטעינה, בהחלפת יום ובלחיצה על "עכשיו"
  const dayKey = startOfDay(day).getTime();
  useEffect(() => {
    const target = isToday && nowTop != null ? nowTop - 140 : 8 * HOUR_HEIGHT - 20;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, target), animated: true }), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, scrollSignal]);

  const total = (DAY_MINUTES / 60) * HOUR_HEIGHT;

  return (
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
      <View style={{ height: total }}>
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} pointerEvents="none" style={{ position: 'absolute', top: h * HOUR_HEIGHT, start: 0, end: 0, height: HOUR_HEIGHT }}>
            <Text variant="small" muted style={{ position: 'absolute', start: 0, top: -8, width: LABEL_W - 8 }}>{String(h).padStart(2, '0')}:00</Text>
            <View style={{ position: 'absolute', start: LABEL_W, end: 0, top: 0, height: 1, backgroundColor: colors.border }} />
          </View>
        ))}

        <Pressable
          style={{ position: 'absolute', top: 0, bottom: 0, start: LABEL_W, end: 0 }}
          onPress={(e) => {
            const minutes = Math.floor(((e.nativeEvent.locationY / HOUR_HEIGHT) * 60) / 15) * 15;
            const at = startOfDay(day);
            at.setMinutes(minutes);
            onSlotPress(at);
          }}
        />

        {reservations.map((r) => {
          const rect = blockRect(r, day, HOUR_HEIGHT);
          if (!rect) return null;
          const mine = r.user_id === uid;
          return (
            <Pressable
              key={r.id}
              onPress={() => onBlockPress(r)}
              style={{
                position: 'absolute', top: rect.top + 1, height: Math.max(rect.height - 2, 22), start: LABEL_W + 6, end: 6,
                backgroundColor: mine ? colors.primary : colors.warningSoft, borderRadius: radius.md,
                borderWidth: mine ? 0 : 1, borderColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: 4, overflow: 'hidden',
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Avatar id={r.user_id} name={nameOf(r.user_id)} size={16} />
                <Text variant="label" numberOfLines={1} style={{ flex: 1, color: mine ? colors.primaryText : colors.text }}>
                  {nameOf(r.user_id)}{r.purpose ? ` · ${r.purpose}` : ''}
                </Text>
                {r.recurring_rule_id ? <Ionicons name="repeat" size={14} color={mine ? colors.primaryText : colors.textMuted} /> : null}
              </View>
              {rect.height >= 44 ? (
                <Text variant="small" style={{ color: mine ? colors.primaryText : colors.textMuted }}>{hh(r.starts_at)}–{hh(r.ends_at)}</Text>
              ) : null}
            </Pressable>
          );
        })}

        {draft && draftRect ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: draftRect.top + 1, height: Math.max(draftRect.height - 2, 22), start: LABEL_W + 6, end: 6,
              borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed',
              borderColor: draft.conflict ? colors.danger : colors.primary,
              backgroundColor: draft.conflict ? colors.dangerSoft : colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 4,
            }}>
            <Text variant="label" style={{ color: draft.conflict ? colors.danger : colors.primary }}>
              {draft.conflict ? 'תפוס' : 'השריון שלך'} · {hh(draft.start)}–{hh(draft.end)}
            </Text>
          </View>
        ) : null}

        {nowTop != null ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: nowTop - 1, start: LABEL_W - 6, end: 0, height: 2, backgroundColor: '#2563EB', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', start: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB', top: -4 }} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
