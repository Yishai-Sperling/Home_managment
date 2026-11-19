import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, Screen, Text, useScreenPadding } from '@/components/ui';
import { HouseHeader } from '@/features/house';
import { BookingSheet } from '@/features/car/BookingSheet';
import { DayTimeline } from '@/features/car/DayTimeline';
import {
  useCancelReservation, useCreateReservation, useHouseDirectory, useReservations, useReservationsForDay,
} from '@/features/car/hooks';
import { currentReservation, hasOverlap } from '@/features/car/overlap';
import { addDays, dayLabel, nextQuarter, startOfDay } from '@/features/car/timeline';
import { useCurrentHouseId, useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';
import type { CarReservation } from '@/types/database';

const MIN = 60_000;
const hh = (iso: string | Date) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

function NavButton({ icon, onPress, label }: { icon: 'chevron-forward' | 'chevron-back'; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: pressed ? colors.border : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' })}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export default function CarScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const uid = session?.user.id;

  const { data: upcoming = [] } = useReservations(houseId);
  const { data: dir } = useHouseDirectory(houseId);
  const create = useCreateReservation();
  const cancel = useCancelReservation();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [scrollSignal, setScrollSignal] = useState(0);
  const { data: dayList = [] } = useReservationsForDay(houseId, day);

  const [booking, setBooking] = useState<{ start: Date; end: Date } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const nameOf = (id: string) => (id === uid ? 'את/ה' : dir?.names[id] ?? 'דייר');
  const canCancel = (r: CarReservation) => r.user_id === uid || !!dir?.isAdmin;
  const current = currentReservation(upcoming, now);
  const mine = current && current.user_id === uid ? current : null;
  const conflict = !!booking && booking.end > booking.start && hasOverlap(upcoming, booking.start, booking.end);

  const openBooking = (start: Date) => {
    Haptics.selectionAsync().catch(() => {});
    setFormError(null);
    setBooking({ start, end: new Date(start.getTime() + 60 * MIN) });
  };
  const openDefault = () => {
    const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
    const start = isToday ? nextQuarter(now) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    openBooking(start);
  };
  const onSlotPress = (at: Date) => {
    if (at.getTime() < now.getTime() - 15 * MIN) return;
    openBooking(at < now ? nextQuarter(now) : at);
  };

  const doCancel = (id: string) => cancel.mutate(id, {
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  });
  const onBlockPress = (r: CarReservation) => {
    const details = `${nameOf(r.user_id)} · ${hh(r.starts_at)}–${hh(r.ends_at)}${r.purpose ? `\nמטרה: ${r.purpose}` : ''}${r.notes ? `\n${r.notes}` : ''}`;
    Alert.alert('שריון רכב', details, canCancel(r)
      ? [{ text: 'סגור', style: 'cancel' }, { text: 'בטל שריון', style: 'destructive', onPress: () => doCancel(r.id) }]
      : [{ text: 'סגור' }]);
  };

  const submit = (purpose: string, notes: string) => {
    if (!booking) return;
    setFormError(null);
    if (booking.start.getTime() < Date.now() - 60_000) { setFormError('לא ניתן לשריין לזמן שעבר'); return; }
    create.mutate({ starts_at: booking.start, ends_at: booking.end, purpose, notes }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setDay(startOfDay(booking.start));
        setBooking(null);
      },
      onError: (e) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setFormError(e.message);
      },
    });
  };

  const busy = !!current;
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();

  return (
    <Screen style={pad}>
      <HouseHeader title="רכב" />

      <Card style={{ backgroundColor: busy ? colors.warningSoft : colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <Ionicons name="car-sport" size={28} color={busy ? colors.warning : colors.success} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{busy ? 'הרכב תפוס' : 'הרכב זמין'}</Text>
          <Text variant="small" muted>{current ? `${nameOf(current.user_id)} עד ${hh(current.ends_at)}` : 'אפשר לקחת עכשיו'}</Text>
        </View>
        {mine ? <Button title="שחרר" variant="secondary" onPress={() => doCancel(mine.id)} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }} /> : null}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }}>
        <NavButton icon="chevron-forward" label="יום קודם" onPress={() => setDay((d) => addDays(d, -1))} />
        <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>{dayLabel(day, now)}</Text>
        <NavButton icon="chevron-back" label="יום הבא" onPress={() => setDay((d) => addDays(d, 1))} />
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setDay(startOfDay(now)); setScrollSignal((n) => n + 1); }}
          style={{ paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: isToday ? colors.primarySoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="label" style={{ color: colors.primary }}>עכשיו</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <DayTimeline
          day={day} now={now} reservations={dayList} uid={uid} nameOf={nameOf} scrollSignal={scrollSignal}
          draft={booking ? { start: booking.start, end: booking.end, conflict } : null}
          onSlotPress={onSlotPress} onBlockPress={onBlockPress}
        />
      </View>

      {!booking ? (
        <Pressable
          onPress={openDefault}
          style={({ pressed }) => ({ position: 'absolute', bottom: spacing.lg, end: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.xl, opacity: pressed ? 0.85 : 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 })}>
          <Ionicons name="add" size={22} color={colors.primaryText} />
          <Text variant="label" style={{ color: colors.primaryText, fontSize: 16 }}>שריון</Text>
        </Pressable>
      ) : null}

      {booking ? (
        <BookingSheet
          now={now} start={booking.start} end={booking.end} conflict={conflict} pending={create.isPending} error={formError}
          onChange={(start, end) => { setFormError(null); setBooking({ start, end }); setDay(startOfDay(start)); }}
          onClose={() => setBooking(null)} onSubmit={submit}
        />
      ) : null}
    </Screen>
  );
}
