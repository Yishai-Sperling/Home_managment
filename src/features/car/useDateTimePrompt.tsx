import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export type PromptKind = 'datetime' | 'date' | 'time';
interface Options { kind: PromptKind; minimum?: Date }

function mergeTime(day: Date, time: Date) {
  const d = new Date(day);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

function promptAndroid(value: Date, { kind, minimum }: Options): Promise<Date | null> {
  return new Promise((resolve) => {
    const openTime = (base: Date) =>
      DateTimePickerAndroid.open({
        value: base, mode: 'time', is24Hour: true,
        onChange: (e, d) => resolve(e.type === 'set' && d ? mergeTime(base, d) : null),
      });
    if (kind === 'time') return openTime(value);
    DateTimePickerAndroid.open({
      value, mode: 'date', minimumDate: minimum,
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return resolve(null);
        const merged = mergeTime(d, value);
        if (kind === 'date') resolve(merged);
        else openTime(merged);
      },
    });
  });
}

/**
 * בורר תאריך ושעה: באנדרואיד דיאלוגים מקוריים (לוח שנה ואחריו שעון גרירה),
 * ב-iOS גיליון תחתון עם לוח שנה ואחריו גלגלי שעה. מחזיר Promise עם התאריך שנבחר או null.
 */
export function useDateTimePrompt() {
  const { colors } = useTheme();
  const [state, setState] = useState<{ value: Date; step: 'date' | 'time'; opts: Options } | null>(null);
  const resolver = useRef<((d: Date | null) => void) | null>(null);

  const close = (result: Date | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const prompt = (value: Date, opts: Options): Promise<Date | null> => {
    if (Platform.OS === 'android') return promptAndroid(value, opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ value, step: opts.kind === 'time' ? 'time' : 'date', opts });
    });
  };

  const sheet = state ? (
    <Modal transparent animationType="slide" visible onRequestClose={() => close(null)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => close(null)} />
      <View style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <Text variant="heading">{state.step === 'date' ? 'בחירת תאריך' : 'בחירת שעה'}</Text>
        <DateTimePicker
          value={state.value}
          mode={state.step}
          display={state.step === 'date' ? 'inline' : 'spinner'}
          minimumDate={state.step === 'date' ? state.opts.minimum : undefined}
          locale="he-IL"
          minuteInterval={5}
          onChange={(_e, d) => { if (d) setState((s) => (s ? { ...s, value: d } : s)); }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="ביטול" variant="secondary" style={{ flex: 1 }} onPress={() => close(null)} />
          {state.step === 'date' ? (
            <Button title={state.opts.kind === 'datetime' ? 'הבא' : 'אישור'} style={{ flex: 1 }} onPress={() => (state.opts.kind === 'datetime' ? setState((s) => (s ? { ...s, step: 'time' } : s)) : close(state.value))} />
          ) : (
            <Button title="אישור" style={{ flex: 1 }} onPress={() => close(state.value)} />
          )}
        </View>
      </View>
    </Modal>
  ) : null;

  return { prompt, sheet };
}
