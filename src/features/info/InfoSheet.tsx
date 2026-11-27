import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { Button, Chip, Input, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import { KIND_LABELS, KIND_ORDER, LABEL_MAX, VALUE_MAX, validateInfo, type InfoForm } from './helpers';

/** גיליון הוספה/עריכה, overlay בתוך המסך (לא Modal). */
export function InfoSheet({ title, initial, onClose, onSave }: {
  title: string; initial: InfoForm; onClose: () => void; onSave: (f: InfoForm) => void;
}) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [form, setForm] = useState<InfoForm>(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateInfo(form);
  const set = <K extends keyof InfoForm>(k: K, v: InfoForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    setSubmitted(true);
    if (errors.label || errors.value) return;
    onSave({ ...form, label: form.label.trim(), value: form.value.trim() });
  };
  const err = (m?: string) => (submitted && m ? <Text variant="small" style={{ color: colors.danger }}>{m}</Text> : null);
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end', zIndex: 50 }}>
      <Pressable onPress={onClose} accessibilityLabel="סגור" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <KeyboardAvoidingView behavior="padding">
        <View style={{
          backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl, maxHeight: windowHeight * 0.9,
        }}>
          <Text variant="heading">{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Input label="כותרת" placeholder="למשל: וויי-פיי בית" value={form.label} maxLength={LABEL_MAX + 20}
                onChangeText={(v) => set('label', v)} autoFocus={!initial.label} />
              {err(errors.label)}
            </View>
            <View style={{ gap: spacing.xs }}>
              <Input label="ערך" value={form.value} maxLength={VALUE_MAX + 50} onChangeText={(v) => set('value', v)}
                multiline={form.kind === 'text'}
                keyboardType={form.kind === 'phone' ? 'phone-pad' : form.kind === 'link' ? 'url' : 'default'}
                autoCapitalize="none" autoCorrect={false}
                style={form.kind === 'text' ? { minHeight: 90, textAlignVertical: 'top' } : undefined} />
              {err(errors.value)}
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text variant="label" muted>סוג</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: spacing.sm }}>
                {KIND_ORDER.map((k) => (
                  <Chip key={k} label={KIND_LABELS[k]} selected={form.kind === k} onPress={() => set('kind', k)} />
                ))}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">מוסתר</Text>
                <Text variant="small" muted>הערך יוצג כ-•••• עד ללחיצה</Text>
              </View>
              <Switch value={form.is_secret} onValueChange={(v) => set('is_secret', v)} />
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="שמור" onPress={save} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
