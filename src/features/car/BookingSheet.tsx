import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Chip, Input, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import { DAY_LETTERS, DEFAULT_DAYS, toggleDay } from './recurrence';
import { addDays, dayLabel, isSameDay, startOfDay } from './timeline';
import { useDateTimePrompt } from './useDateTimePrompt';

const hh = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const MIN = 60_000;
const DURATIONS = [
  { label: '30 דק׳', min: 30 }, { label: 'שעה', min: 60 }, { label: 'שעתיים', min: 120 }, { label: '3 שעות', min: 180 },
];

export type SheetMode = 'create' | 'editOne' | 'editSeries';

export interface SheetSubmit {
  purpose: string;
  notes: string;
  /** מוגדר רק כשהשריון חוזר (יצירת סדרה או עריכתה) */
  recurring?: { days: number[]; endsOn: Date | null };
}

export interface SheetInitial { purpose?: string; notes?: string; days?: number[]; endsOn?: Date | null }

interface Props {
  mode: SheetMode;
  now: Date;
  start: Date;
  end: Date;
  conflict: boolean;
  pending: boolean;
  error: string | null;
  initial?: SheetInitial;
  onChange: (start: Date, end: Date) => void;
  /** נקרא כשמפעילים/מכבים "חוזר" (כדי שהמסך יסתיר את תצוגת הטיוטה) */
  onRecurringChange?: (recurring: boolean) => void;
  onClose: () => void;
  onSubmit: (v: SheetSubmit) => void;
}

function TimeField({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? colors.surfaceAlt : colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 })}>
      <Text variant="small" muted>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '700' }}>{hh(value)}</Text>
    </Pressable>
  );
}

const TITLES: Record<SheetMode, string> = { create: 'שריון רכב', editOne: 'עריכת שריון', editSeries: 'עריכת סדרה חוזרת' };

/** גיליון שריון/עריכה, בנוי כ-overlay בתוך המסך (לא Modal) כדי שבורר השעה של iOS ייפתח מעליו. */
export function BookingSheet({ mode, now, start, end, conflict, pending, error, initial, onChange, onRecurringChange, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const { prompt, sheet } = useDateTimePrompt();
  const [purpose, setPurpose] = useState(initial?.purpose ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [recurring, setRecurring] = useState(mode === 'editSeries');
  const [days, setDays] = useState<number[]>(initial?.days ?? DEFAULT_DAYS);
  const [endsOn, setEndsOn] = useState<Date | null>(initial?.endsOn ?? null);

  const durationMin = Math.round((end.getTime() - start.getTime()) / MIN);
  const today = startOfDay(now);
  const tomorrow = addDays(now, 1);
  const isOther = !isSameDay(start, today) && !isSameDay(start, tomorrow);
  const series = recurring; // יצירת סדרה או עריכת סדרה
  const crossesMidnight = series && !isSameDay(start, end);
  const noDays = series && days.length === 0;
  const invalid = end <= start || crossesMidnight || noDays;
  const showConflict = conflict && !series;

  const moveToDay = (day: Date) => {
    const s = new Date(day); s.setHours(start.getHours(), start.getMinutes(), 0, 0);
    onChange(s, new Date(s.getTime() + durationMin * MIN));
  };
  const pickDay = async () => {
    const d = await prompt(start, { kind: 'date', minimum: today });
    if (d) moveToDay(d);
  };
  const pickStart = async () => {
    const t = await prompt(start, { kind: 'time' });
    if (!t) return;
    onChange(t, new Date(t.getTime() + Math.max(durationMin, 15) * MIN));
  };
  const pickEnd = async () => {
    const t = await prompt(end, { kind: 'time' });
    if (!t) return;
    const e = new Date(start); e.setHours(t.getHours(), t.getMinutes(), 0, 0);
    onChange(start, e <= start ? new Date(e.getTime() + 24 * 60 * MIN) : e);
  };
  const pickEndsOn = async () => {
    const d = await prompt(endsOn ?? start, { kind: 'date', minimum: startOfDay(start) });
    if (d) setEndsOn(startOfDay(d));
  };
  const setRec = (v: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setRecurring(v);
    onRecurringChange?.(v);
  };

  const submitTitle = mode === 'editOne' ? 'שמור שינויים' : mode === 'editSeries' ? 'שמור סדרה' : recurring ? 'צור סדרה' : 'שריין';

  return (
    <>
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="סגירה" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, start: 0, end: 0 }}>
        <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 1.4, borderTopRightRadius: radius.lg * 1.4, maxHeight: 640 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="heading" style={{ flex: 1 }}>{TITLES[mode]}</Text>
              <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>

            {mode === 'create' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="repeat" size={20} color={colors.primary} />
                <Text variant="label" style={{ flex: 1 }}>חוזר</Text>
                <Switch value={recurring} onValueChange={setRec} trackColor={{ true: colors.primary }} />
              </View>
            ) : null}

            {series ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" muted>בימים</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {DAY_LETTERS.map((letter, d) => (
                    <Chip key={d} label={letter} selected={days.includes(d)} onPress={() => setDays((cur) => toggleDay(cur, d))} />
                  ))}
                </View>
              </View>
            ) : mode === 'editOne' ? null : (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" muted>מתי</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Chip label="היום" selected={isSameDay(start, today)} onPress={() => moveToDay(today)} />
                  <Chip label="מחר" selected={isSameDay(start, tomorrow)} onPress={() => moveToDay(tomorrow)} />
                  <Chip label={isOther ? dayLabel(start, now) : 'תאריך אחר…'} selected={isOther} onPress={pickDay} />
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TimeField label="משעה" value={start} onPress={pickStart} />
              <TimeField label="עד שעה" value={end} onPress={pickEnd} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" muted>משך</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {DURATIONS.map((d) => (
                  <Chip key={d.min} label={d.label} selected={durationMin === d.min}
                    onPress={() => onChange(start, new Date(start.getTime() + d.min * MIN))} />
                ))}
              </View>
              {mode === 'editOne' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Chip label="הארך ב-30 דק׳" onPress={() => onChange(start, new Date(end.getTime() + 30 * MIN))} />
                  <Chip label="הארך בשעה" onPress={() => onChange(start, new Date(end.getTime() + 60 * MIN))} />
                </View>
              ) : null}
            </View>

            {series ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" muted>עד תאריך</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Chip label="ללא הגבלה" selected={!endsOn} onPress={() => setEndsOn(null)} />
                  <Chip label={endsOn ? endsOn.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : 'בחירת תאריך…'} selected={!!endsOn} onPress={pickEndsOn} />
                </View>
              </View>
            ) : null}

            {showConflict ? <Text style={{ color: colors.danger, fontWeight: '600' }}>הרכב כבר תפוס בחלון הזמן הזה</Text> : null}
            {crossesMidnight ? <Text variant="small" style={{ color: colors.danger }}>שריון חוזר לא יכול לחצות חצות</Text> : null}
            {noDays ? <Text variant="small" style={{ color: colors.danger }}>בחרו לפחות יום אחד</Text> : null}

            <Input label="מטרה (אופציונלי)" placeholder="לאן נוסעים?" value={purpose} onChangeText={setPurpose} />
            {!series ? <Input label="הערות (אופציונלי)" value={notes} onChangeText={setNotes} multiline /> : null}
            {error ? <Text variant="small" style={{ color: colors.danger }}>{error}</Text> : null}
            <Button
              title={submitTitle} loading={pending} disabled={showConflict || invalid}
              onPress={() => onSubmit({ purpose, notes, recurring: series ? { days, endsOn } : undefined })}
            />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
      {sheet}
    </>
  );
}
