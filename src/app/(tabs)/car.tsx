import { HouseHeader } from '@/features/house';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useListMotion, softLayout, type ListMotion } from '@/theme/motion';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { useCurrentHouseId, useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';
import type { CarReservation } from '@/types/database';
import {
  useCancelReservation, useCreateReservation, useHouseDirectory, useReservations,
} from '@/features/car/hooks';
import { currentReservation, hasOverlap, reservationsToday } from '@/features/car/overlap';
import { useDateTimePrompt } from '@/features/car/useDateTimePrompt';

const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
const rangeFmt = (r: CarReservation) => {
  const sameDay = new Date(r.starts_at).toDateString() === new Date(r.ends_at).toDateString();
  return sameDay
    ? `${dateFmt(r.starts_at)} · ${timeFmt(r.starts_at)}–${timeFmt(r.ends_at)}`
    : `${dateFmt(r.starts_at)} ${timeFmt(r.starts_at)} – ${dateFmt(r.ends_at)} ${timeFmt(r.ends_at)}`;
};

function defaultStart() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

function TimeRow({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  const { colors } = useTheme();
  const iso = value.toISOString();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: pressed ? colors.surfaceAlt : colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md })}>
      <Ionicons name="calendar-outline" size={22} color={colors.primary} />
      <Text variant="label" muted style={{ width: 56 }}>{label}</Text>
      <Text style={{ flex: 1, fontWeight: '600' }}>{dateFmt(iso)} · {timeFmt(iso)}</Text>
      <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function ReservationRow({ r, who, canCancel, onCancel, motion }: { motion: ListMotion; r: CarReservation; who: string; canCancel: boolean; onCancel: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={motion.entering} exiting={motion.exiting} layout={motion.layout}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontWeight: '600' }}>{who}{r.purpose ? ` · ${r.purpose}` : ''}</Text>
        <Text variant="small" muted>{rangeFmt(r)}</Text>
        {r.notes ? <Text variant="small" muted>{r.notes}</Text> : null}
      </View>
      {canCancel ? (
        <Button
          title="ביטול" variant="secondary" style={{ paddingVertical: 8, paddingHorizontal: spacing.md }}
          onPress={() => Alert.alert('ביטול הזמנה', 'לבטל את ההזמנה?', [
            { text: 'לא', style: 'cancel' },
            { text: 'בטל הזמנה', style: 'destructive', onPress: onCancel },
          ])}
        />
      ) : null}
    </Animated.View>
  );
}

export default function CarScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const uid = session?.user.id;

  const { data: list = [], isLoading, error, refetch } = useReservations(houseId);
  const motion = useListMotion(!isLoading);
  const { data: dir } = useHouseDirectory(houseId);
  const create = useCreateReservation();
  const cancel = useCancelReservation();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(() => new Date(defaultStart().getTime() + 60 * 60 * 1000));
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { prompt, sheet } = useDateTimePrompt();
  const hour = 60 * 60 * 1000;

  // לחיצה על "התחלה": תאריך + שעה, ואחריהם מיד שעת סיום.
  const pickStart = async () => {
    const s = await prompt(start, { kind: 'datetime', minimum: new Date() });
    if (!s) return;
    setStart(s);
    let e = new Date(s.getTime() + hour);
    const picked = await prompt(e, { kind: 'time' });
    if (picked) {
      e = new Date(s);
      e.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      if (e <= s) e = new Date(e.getTime() + 24 * hour);
    }
    setEnd(e);
  };
  const pickEnd = async () => {
    const e = await prompt(end, { kind: 'datetime', minimum: start });
    if (e) setEnd(e);
  };
  const conflict = end > start && hasOverlap(list, start, end);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const durationText = `${Math.floor(durationMin / 60) ? `${Math.floor(durationMin / 60)} ש׳ ` : ''}${durationMin % 60 ? `${durationMin % 60} ד׳` : ''}`.trim();

  const nameOf = (id: string) => (id === uid ? 'את/ה' : dir?.names[id] ?? 'דייר');
  const current = useMemo(() => currentReservation(list, now), [list, now]);
  const today = useMemo(() => reservationsToday(list, now), [list, now]);
  const upcoming = useMemo(() => {
    const todayIds = new Set(today.map((r) => r.id));
    return list.filter((r) => !todayIds.has(r.id) && new Date(r.starts_at) > now);
  }, [list, today, now]);
  const mine = current && current.user_id === uid ? current : null;
  const canCancel = (r: CarReservation) => r.user_id === uid || !!dir?.isAdmin;

  const submit = () => {
    setFormError(null);
    if (start.getTime() < Date.now() - 60_000) { setFormError('לא ניתן להזמין לזמן שעבר'); return; }
    if (end <= start) { setFormError('שעת הסיום חייבת להיות אחרי שעת ההתחלה'); return; }
    if (hasOverlap(list, start, end)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFormError('הרכב כבר תפוס בחלון הזמן הזה');
      return;
    }
    create.mutate({ starts_at: start, ends_at: end, purpose, notes }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPurpose(''); setNotes('');
      },
      onError: (e) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setFormError(e.message);
      },
    });
  };

  const busy = !!current;
  const doCancel = (id: string) => cancel.mutate(id, { onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) });

  return (
    <Screen style={pad}>
      <HouseHeader />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Text variant="title">רכב</Text>

        <Animated.View layout={softLayout}>
          <Card style={{ backgroundColor: busy ? colors.warningSoft : colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="car-sport" size={34} color={busy ? colors.warning : colors.success} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{busy ? 'הרכב תפוס' : 'הרכב זמין'}</Text>
              <Text muted>
                {current ? `${nameOf(current.user_id)} עד ${timeFmt(current.ends_at)}` : 'אפשר לקחת עכשיו'}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {mine ? (
          <Animated.View>
            <Card style={{ backgroundColor: colors.primarySoft, gap: spacing.sm }}>
              <Text variant="label" style={{ color: colors.primary }}>יש לך הזמנה פעילה</Text>
              <Text>{rangeFmt(mine)}</Text>
              <Button title="סיימתי, שחרר את הרכב" variant="secondary" onPress={() => doCancel(mine.id)} />
            </Card>
          </Animated.View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">היום</Text>
          {isLoading ? <Text muted>טוען…</Text> : error ? (
            <EmptyState title="שגיאה בטעינה" hint="נסו שוב" />
          ) : today.length === 0 ? (
            <Text muted>אין הזמנות להיום</Text>
          ) : today.map((r) => (
            <ReservationRow key={r.id} motion={motion} r={r} who={nameOf(r.user_id)} canCancel={canCancel(r)} onCancel={() => doCancel(r.id)} />
          ))}
        </View>

        {upcoming.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading">בקרוב</Text>
            {upcoming.map((r) => (
              <ReservationRow key={r.id} motion={motion} r={r} who={nameOf(r.user_id)} canCancel={canCancel(r)} onCancel={() => doCancel(r.id)} />
            ))}
          </View>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">הזמנת הרכב</Text>
          <TimeRow label="התחלה" value={start} onPress={pickStart} />
          <TimeRow label="סיום" value={end} onPress={pickEnd} />
          {durationText ? <Text variant="small" muted>משך: {durationText}</Text> : null}
          {conflict ? <Text variant="small" style={{ color: colors.danger }}>הרכב כבר תפוס בחלון הזמן הזה</Text> : null}
          <Input label="מטרה" placeholder="לאן נוסעים?" value={purpose} onChangeText={setPurpose} />
          <Input label="הערות" placeholder="אופציונלי" value={notes} onChangeText={setNotes} multiline />
          {formError ? <Text variant="small" style={{ color: colors.danger }}>{formError}</Text> : null}
          <Button title="הזמן רכב" onPress={submit} loading={create.isPending} disabled={!houseId || conflict} />
          <Button title="רענון" variant="ghost" onPress={() => { refetch(); }} />
        </Card>
      </ScrollView>
      {sheet}
    </Screen>
  );
}
