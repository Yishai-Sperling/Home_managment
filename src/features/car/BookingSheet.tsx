import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Chip, Input, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import { addDays, dayLabel, isSameDay, startOfDay } from './timeline';
import { useDateTimePrompt } from './useDateTimePrompt';

const hh = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const MIN = 60_000;
const DURATIONS = [
  { label: '30 דק׳', min: 30 }, { label: 'שעה', min: 60 }, { label: 'שעתיים', min: 120 }, { label: '3 שעות', min: 180 },
];

interface Props {
  now: Date;
  start: Date;
  end: Date;
  conflict: boolean;
  pending: boolean;
  error: string | null;
  onChange: (start: Date, end: Date) => void;
  onClose: () => void;
  onSubmit: (purpose: string, notes: string) => void;
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

/** גיליון שריון מהיר, בנוי כ-overlay בתוך המסך (לא Modal) כדי שבורר השעה של iOS ייפתח מעליו. */
export function BookingSheet({ now, start, end, conflict, pending, error, onChange, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const { prompt, sheet } = useDateTimePrompt();
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const durationMin = Math.round((end.getTime() - start.getTime()) / MIN);
  const today = startOfDay(now);
  const tomorrow = addDays(now, 1);
  const isOther = !isSameDay(start, today) && !isSameDay(start, tomorrow);

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

  return (
    <>
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="סגירה" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, start: 0, end: 0 }}>
        <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 1.4, borderTopRightRadius: radius.lg * 1.4, maxHeight: 640 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="heading" style={{ flex: 1 }}>שריון רכב</Text>
              <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" muted>מתי</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Chip label="היום" selected={isSameDay(start, today)} onPress={() => moveToDay(today)} />
                <Chip label="מחר" selected={isSameDay(start, tomorrow)} onPress={() => moveToDay(tomorrow)} />
                <Chip label={isOther ? dayLabel(start, now) : 'תאריך אחר…'} selected={isOther} onPress={pickDay} />
              </View>
            </View>

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
            </View>

            {conflict ? <Text style={{ color: colors.danger, fontWeight: '600' }}>הרכב כבר תפוס בחלון הזמן הזה</Text> : null}

            <Input label="מטרה (אופציונלי)" placeholder="לאן נוסעים?" value={purpose} onChangeText={setPurpose} />
            <Input label="הערות (אופציונלי)" value={notes} onChangeText={setNotes} multiline />
            {error ? <Text variant="small" style={{ color: colors.danger }}>{error}</Text> : null}
            <Button title="שריין" onPress={() => onSubmit(purpose, notes)} loading={pending} disabled={conflict || end <= start} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
      {sheet}
    </>
  );
}
