import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Button, Card, Input, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId } from '@/lib/session';
import { AuthShell, ErrorText } from '@/features/house/AuthShell';
import { authErrorMessage, useCreateHouse, useJoinHouse } from '@/features/house/hooks';
import { radius, spacing, useTheme } from '@/theme';

type Mode = 'choose' | 'create' | 'join';

function Choice({ icon, title, hint, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; hint: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{title}</Text>
          <Text variant="small" muted>{hint}</Text>
        </View>
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const hasHouse = !!useCurrentHouseId();
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHouse();
  const join = useJoinHouse();

  const fail = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(msg);
  };
  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/(tabs)');
  };

  async function submitCreate() {
    if (name.trim().length < 2) return fail('יש להזין שם לבית');
    setError(null);
    try {
      await create.mutateAsync(name.trim());
      done();
    } catch (e) {
      fail(authErrorMessage((e as Error).message));
    }
  }
  async function submitJoin() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return fail('יש להזין קוד בית');
    setError(null);
    try {
      await join.mutateAsync(c);
      done();
    } catch (e) {
      fail(authErrorMessage((e as Error).message));
    }
  }

  const back = () => { setError(null); setMode('choose'); };

  return (
    <AuthShell title={mode === 'create' ? 'צור בית חדש' : mode === 'join' ? 'הצטרף לבית' : hasHouse ? 'הוספת בית' : 'ברוכים הבאים'} subtitle={mode === 'choose' ? 'צרו בית חדש או הצטרפו לבית קיים עם קוד' : undefined}>
      {mode === 'choose' && (
        <Animated.View entering={FadeIn} style={{ gap: spacing.md }}>
          <Choice icon="add-circle" title="צור בית חדש" hint="פתחו בית ושתפו את הקוד עם השותפים" onPress={() => setMode('create')} />
          <Choice icon="key" title="הצטרף לבית" hint="יש לכם קוד מהשותפים? הזינו אותו כאן" onPress={() => setMode('join')} />
          {hasHouse ? (
            <Button title="חזרה" variant="ghost" onPress={() => router.back()} />
          ) : (
            <Button title="התנתקות" variant="ghost" onPress={() => supabase.auth.signOut()} />
          )}
        </Animated.View>
      )}
      {mode === 'create' && (
        <Animated.View entering={FadeInDown.duration(250)} style={{ gap: spacing.md }}>
          <Input label="שם הבית" value={name} onChangeText={setName} placeholder="למשל: הדירה ברחוב הרצל" autoFocus onSubmitEditing={submitCreate} returnKeyType="done" />
          <ErrorText message={error} />
          <Button title="צור בית" onPress={submitCreate} loading={create.isPending} />
          <Button title="חזרה" variant="ghost" onPress={back} />
        </Animated.View>
      )}
      {mode === 'join' && (
        <Animated.View entering={FadeInDown.duration(250)} style={{ gap: spacing.md }}>
          <Input label="קוד הבית" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="ABC123" autoFocus onSubmitEditing={submitJoin} returnKeyType="done" style={{ textAlign: 'center', letterSpacing: 4, fontWeight: '700', color: colors.primary }} />
          <ErrorText message={error} />
          <Button title="הצטרף" onPress={submitJoin} loading={join.isPending} />
          <Button title="חזרה" variant="ghost" onPress={back} />
        </Animated.View>
      )}
    </AuthShell>
  );
}
