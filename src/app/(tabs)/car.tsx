import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, Screen, Text, useScreenPadding } from '@/components/ui';
import { HouseHeader } from '@/features/house';
import { ActionSheet, type SheetAction } from '@/features/car/ActionSheet';
import { BookingSheet, type SheetMode, type SheetSubmit } from '@/features/car/BookingSheet';
import { DayTimeline } from '@/features/car/DayTimeline';
import {
  ruleEndsOnDate, useCancelReservation, useCreateReservation, useCreateRule, useDeleteRule, useHouseDirectory,
  useRecurringRules, useReservations, useReservationsForDay, useSkipOccurrence, useUpdateReservation, useUpdateRule,
} from '@/features/car/hooks';
import { RulesSheet } from '@/features/car/RulesSheet';
import { currentReservation, hasOverlap } from '@/features/car/overlap';
import { applyTime, createResultMessage, dateToHHMM, summarizeRule } from '@/features/car/recurrence';
import { addDays, dayLabel, nextQuarter, startOfDay } from '@/features/car/timeline';
import { useMaterializeRecurring } from '@/features/car/useMaterialize';
import { useCurrentHouseId, useSession } from '@/lib/session';
import { radius, spacing, useTheme } from '@/theme';
import type { CarRecurringRule, CarReservation } from '@/types/database';

interface SheetState {
  mode: SheetMode;
  start: Date;
  end: Date;
  reservation?: CarReservation;
  rule?: CarRecurringRule;
}

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
  const { data: rules = [], isLoading: rulesLoading } = useRecurringRules(houseId);
  const create = useCreateReservation();
  const cancel = useCancelReservation();
  const updateOne = useUpdateReservation();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const skip = useSkipOccurrence();
  const deleteRule = useDeleteRule();
  useMaterializeRecurring(houseId);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [scrollSignal, setScrollSignal] = useState(0);
  const { data: dayList = [] } = useReservationsForDay(houseId, day);

  const [booking, setBooking] = useState<SheetState | null>(null);
  const [recurringOn, setRecurringOn] = useState(false);
  const [selected, setSelected] = useState<CarReservation | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = !!dir?.isAdmin;
  const nameOf = (id: string) => (id === uid ? 'את/ה' : dir?.names[id] ?? 'דייר');
  const canManage = (r: { user_id: string }) => r.user_id === uid || isAdmin;
  const current = currentReservation(upcoming, now);
  const mine = current && current.user_id === uid ? current : null;
  const seriesMode = booking?.mode === 'editSeries' || recurringOn;
  const conflict = !!booking && !seriesMode && booking.end > booking.start && hasOverlap(upcoming, booking.start, booking.end, booking.reservation?.id);

  const openSheet = (s: SheetState) => {
    Haptics.selectionAsync().catch(() => {});
    setFormError(null);
    setRecurringOn(s.mode === 'editSeries');
    setBooking(s);
  };
  const openBooking = (start: Date) => openSheet({ mode: 'create', start, end: new Date(start.getTime() + 60 * MIN) });
  const openDefault = () => {
    const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
    const start = isToday ? nextQuarter(now) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    openBooking(start);
  };
  const onSlotPress = (at: Date) => {
    if (at.getTime() < now.getTime() - 15 * MIN) return;
    openBooking(at < now ? nextQuarter(now) : at);
  };
  const openEditSeries = (rule: CarRecurringRule) => {
    setSelected(null);
    setRulesOpen(false);
    const base = startOfDay(day);
    openSheet({ mode: 'editSeries', rule, start: applyTime(base, rule.start_time), end: applyTime(base, rule.end_time) });
  };
  const openEditOne = (r: CarReservation) => {
    setSelected(null);
    openSheet({ mode: 'editOne', reservation: r, start: new Date(r.starts_at), end: new Date(r.ends_at) });
  };

  const ok = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  const fail = (e: Error) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Alert.alert('הפעולה נכשלה', e.message);
  };
  const doCancel = (id: string) => cancel.mutate(id, { onSuccess: ok });
  const confirmDeleteRule = (rule: CarRecurringRule) => {
    Alert.alert('ביטול כל הסדרה', `${summarizeRule(rule)}\nכל השריונים העתידיים בסדרה יימחקו.`, [
      { text: 'השאר', style: 'cancel' },
      { text: 'בטל את כל הסדרה', style: 'destructive', onPress: () => { setSelected(null); deleteRule.mutate(rule.id, { onSuccess: ok, onError: fail }); } },
    ]);
  };

  const blockActions = (r: CarReservation): SheetAction[] => {
    if (!canManage(r)) return [];
    if (r.recurring_rule_id) {
      const rule = rules.find((x) => x.id === r.recurring_rule_id);
      const list: SheetAction[] = [
        { label: 'בטל רק את היום הזה', icon: 'close-circle-outline', destructive: true,
          onPress: () => { setSelected(null); skip.mutate(r.id, { onSuccess: ok, onError: fail }); } },
      ];
      if (rule) {
        list.push({ label: 'ערוך סדרה', icon: 'create-outline', onPress: () => openEditSeries(rule) });
        list.push({ label: 'בטל את כל הסדרה', icon: 'trash-outline', destructive: true, onPress: () => confirmDeleteRule(rule) });
      }
      return list;
    }
    return [
      { label: 'ערוך', icon: 'create-outline', onPress: () => openEditOne(r) },
      { label: 'בטל שריון', icon: 'trash-outline', destructive: true, onPress: () => { setSelected(null); doCancel(r.id); } },
    ];
  };

  const submit = (v: SheetSubmit) => {
    if (!booking) return;
    setFormError(null);
    const { mode, start, end } = booking;
    const onError = (e: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFormError(e.message);
    };
    const done = (msg: string) => { ok(); setDay(startOfDay(start)); setBooking(null); setRecurringOn(false); Alert.alert('שריון חוזר', msg); };

    if (v.recurring) {
      const input = { days: v.recurring.days, start: dateToHHMM(start), end: dateToHHMM(end), purpose: v.purpose, endsOn: v.recurring.endsOn };
      if (mode === 'editSeries' && booking.rule) {
        updateRule.mutate({ ...input, ruleId: booking.rule.id }, {
          onSuccess: (r) => done(r.conflicts > 0 ? 'הסדרה עודכנה\n' + (r.conflicts === 1 ? 'יום אחד דולג' : `${r.conflicts} ימים דולגו`) + ' כי הרכב כבר תפוס' : 'הסדרה עודכנה'),
          onError,
        });
      } else {
        createRule.mutate(input, { onSuccess: (r) => done(createResultMessage(r.created, r.conflicts)), onError });
      }
      return;
    }
    if (mode === 'editOne' && booking.reservation) {
      updateOne.mutate({ id: booking.reservation.id, starts_at: start, ends_at: end, purpose: v.purpose, notes: v.notes }, {
        onSuccess: () => { ok(); setBooking(null); }, onError,
      });
      return;
    }
    if (start.getTime() < Date.now() - 60_000) { setFormError('לא ניתן לשריין לזמן שעבר'); return; }
    create.mutate({ starts_at: start, ends_at: end, purpose: v.purpose, notes: v.notes }, {
      onSuccess: () => { ok(); setDay(startOfDay(start)); setBooking(null); },
      onError,
    });
  };

  const sheetInitial = booking?.mode === 'editSeries' && booking.rule
    ? { purpose: booking.rule.purpose ?? '', days: booking.rule.days, endsOn: ruleEndsOnDate(booking.rule) }
    : booking?.mode === 'editOne' && booking.reservation
      ? { purpose: booking.reservation.purpose ?? '', notes: booking.reservation.notes ?? '' }
      : undefined;
  const pending = create.isPending || updateOne.isPending || createRule.isPending || updateRule.isPending;

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
        <Pressable
          accessibilityLabel="שריונים חוזרים"
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setRulesOpen(true); }}
          style={{ height: 40, minWidth: 40, paddingHorizontal: spacing.sm, flexDirection: 'row', gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="repeat" size={20} color={colors.primary} />
          {rules.length > 0 ? <Text variant="label" style={{ color: colors.primary }}>{rules.length}</Text> : null}
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <DayTimeline
          day={day} now={now} reservations={dayList} uid={uid} nameOf={nameOf} scrollSignal={scrollSignal}
          draft={booking && !seriesMode ? { start: booking.start, end: booking.end, conflict } : null}
          onSlotPress={onSlotPress} onBlockPress={setSelected}
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
          key={`${booking.mode}:${booking.reservation?.id ?? booking.rule?.id ?? 'new'}`}
          mode={booking.mode} now={now} start={booking.start} end={booking.end} conflict={conflict}
          pending={pending} error={formError} initial={sheetInitial}
          onChange={(start, end) => { setFormError(null); setBooking((b) => (b ? { ...b, start, end } : b)); setDay(startOfDay(start)); }}
          onRecurringChange={setRecurringOn}
          onClose={() => { setBooking(null); setRecurringOn(false); }} onSubmit={submit}
        />
      ) : null}

      {selected && !booking ? (
        <ActionSheet
          title={nameOf(selected.user_id)}
          person={{ id: selected.user_id, name: nameOf(selected.user_id) }}
          recurring={!!selected.recurring_rule_id}
          lines={[`${hh(selected.starts_at)}–${hh(selected.ends_at)}`, ...(selected.purpose ? [`מטרה: ${selected.purpose}`] : []), ...(selected.notes ? [selected.notes] : [])]}
          actions={blockActions(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {rulesOpen && !booking ? (
        <RulesSheet
          rules={rules} loading={rulesLoading} uid={uid} isAdmin={isAdmin} nameOf={nameOf}
          onEdit={openEditSeries} onDelete={confirmDeleteRule} onClose={() => setRulesOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
