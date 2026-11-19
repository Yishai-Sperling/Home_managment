import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
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
import { DateTimeStepper } from '@/features/car/DateTimeStepper';

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

function ReservationRow({ r, who, canCancel, onCancel }: { r: CarReservation; who: string; canCancel: boolean; onCancel: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(180)}
      layout={LinearTransition.springify().damping(18)}
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
      {/* TODO(B): <HouseHeader /> from '@/features/house' goes here */}
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Text variant="title">רכב</Text>

        <Animated.View layout={LinearTransition.springify().damping(18)}>
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
          <Animated.View entering={FadeInDown} exiting={FadeOut}>
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
            <ReservationRow key={r.id} r={r} who={nameOf(r.user_id)} canCancel={canCancel(r)} onCancel={() => doCancel(r.id)} />
          ))}
        </View>

        {upcoming.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading">בקרוב</Text>
            {upcoming.map((r) => (
              <ReservationRow key={r.id} r={r} who={nameOf(r.user_id)} canCancel={canCancel(r)} onCancel={() => doCancel(r.id)} />
            ))}
          </View>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">הזמנת הרכב</Text>
          <DateTimeStepper label="התחלה" value={start} onChange={(d) => { setStart(d); if (end <= d) setEnd(new Date(d.getTime() + 60 * 60 * 1000)); }} />
          <DateTimeStepper label="סיום" value={end} onChange={setEnd} />
          <Input label="מטרה" placeholder="לאן נוסעים?" value={purpose} onChangeText={setPurpose} />
          <Input label="הערות" placeholder="אופציונלי" value={notes} onChangeText={setNotes} multiline />
          {formError ? <Text variant="small" style={{ color: colors.danger }}>{formError}</Text> : null}
          <Button title="הזמן רכב" onPress={submit} loading={create.isPending} disabled={!houseId} />
          <Button title="רענון" variant="ghost" onPress={() => { refetch(); }} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
