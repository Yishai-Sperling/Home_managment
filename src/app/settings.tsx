import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { roleLabels } from '@/lib/labels';
import { unregisterPush } from '@/features/notifications/registerPush';
import { supabase } from '@/lib/supabase';
import { useProfile, useSession } from '@/lib/session';
import { useCurrentHouse, useHouseMembers, useLeaveHouse, useRemoveMember, useUpdateProfile } from '@/features/house/hooks';
import { radius, spacing, useTheme } from '@/theme';

async function copyText(text: string): Promise<boolean> {
  try {
    // expo-clipboard אינו מותקן בפרויקט עדיין; אם יתווסף — ההעתקה תעבוד אוטומטית.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

function Section({ title, delay = 0, children }: { title: string; delay?: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} style={{ gap: spacing.sm }}>
      <Text variant="label" muted>{title}</Text>
      {children}
    </Animated.View>
  );
}

export { ErrorBoundary } from 'expo-router';

export default function SettingsScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const { session } = useSession();
  const profile = useProfile().data;
  const { house, isAdmin } = useCurrentHouse();
  const members = useHouseMembers();
  const updateProfile = useUpdateProfile();
  const removeMember = useRemoveMember();
  const leave = useLeaveHouse();

  // טיוטה: null = עדיין לא נערך, מציגים את הערך מהפרופיל
  const [nameDraft, setName] = useState<string | null>(null);
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const name = nameDraft ?? profile?.full_name ?? '';
  const phone = phoneDraft ?? profile?.phone ?? '';
  const [saved, setSaved] = useState(false);

  const dirty = !!profile && (name.trim() !== (profile.full_name ?? '') || phone.trim() !== (profile.phone ?? ''));

  function saveProfile() {
    if (name.trim().length < 2) return Alert.alert('שגיאה', 'יש להזין שם מלא');
    updateProfile.mutate(
      { full_name: name.trim(), phone: phone.trim() || null },
      {
        onSuccess: () => { setName(null); setPhone(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setSaved(true); setTimeout(() => setSaved(false), 1800); },
        onError: () => Alert.alert('שגיאה', 'לא הצלחנו לשמור, נסו שוב'),
      },
    );
  }

  async function copyCode() {
    if (!house) return;
    const ok = await copyText(house.join_code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (ok) Alert.alert('הועתק', 'קוד הבית הועתק ללוח');
    else Share.share({ message: house.join_code }).catch(() => {});
  }

  async function shareWhatsapp() {
    if (!house) return;
    const text = `הצטרפו אלינו לבית "${house.name}" באפליקציה! קוד ההצטרפות: ${house.join_code}`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else await Share.share({ message: text });
    } catch {
      Share.share({ message: text }).catch(() => {});
    }
  }

  function confirmRemove(userId: string, label: string) {
    Alert.alert('הסרת דייר', `להסיר את ${label} מהבית?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'הסר', style: 'destructive', onPress: () => removeMember.mutate(userId, { onError: () => Alert.alert('שגיאה', 'ההסרה נכשלה') }) },
    ]);
  }

  function confirmLeave() {
    Alert.alert('עזיבת הבית', `לעזוב את "${house?.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'עזוב', style: 'destructive',
        onPress: () => leave.mutate(undefined, {
          onSuccess: () => router.replace('/'),
          onError: (e) => Alert.alert('לא ניתן לעזוב', (e as Error).message),
        }),
      },
    ]);
  }

  function confirmSignOut() {
    Alert.alert('התנתקות', 'להתנתק מהחשבון?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'התנתק', style: 'destructive', onPress: async () => { await unregisterPush(); await supabase.auth.signOut(); } },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[pad, { paddingBottom: spacing.xxl * 2, gap: spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="חזרה" style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
          <Text variant="title">הגדרות</Text>
        </View>

        <Section title="הפרופיל שלי">
          <Card style={{ gap: spacing.md }}>
            <Input label="שם מלא" value={name} onChangeText={setName} />
            <Input label="טלפון" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="050-0000000" />
            <Text variant="small" muted>{session?.user.email}</Text>
            <Button title={saved ? 'נשמר ✓' : 'שמירה'} onPress={saveProfile} disabled={!dirty} loading={updateProfile.isPending} />
          </Card>
        </Section>

        {house ? (
          <Section title={`הבית: ${house.name}`} delay={80}>
            <Card style={{ gap: spacing.md, alignItems: 'stretch' }}>
              <Text variant="small" muted>קוד הצטרפות</Text>
              <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6, textAlign: 'center', color: colors.primary }} selectable>{house.join_code}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="העתק קוד" variant="secondary" onPress={copyCode} style={{ flex: 1 }} />
                <Button title="שתף בוואטסאפ" onPress={shareWhatsapp} style={{ flex: 1 }} />
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title={`דיירים${members.data ? ` (${members.data.length})` : ''}`} delay={160}>
          <Card style={{ padding: 0 }}>
            {(members.data ?? []).map((m, i) => {
              const isMe = m.user_id === session?.user.id;
              const label = m.profile?.full_name || 'דייר ללא שם';
              return (
                <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>{label.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{label}{isMe ? ' (אני)' : ''}</Text>
                    <Text variant="small" muted>{roleLabels[m.role]}{m.profile?.phone ? ` · ${m.profile.phone}` : ''}</Text>
                  </View>
                  {isAdmin && !isMe ? (
                    <Pressable onPress={() => confirmRemove(m.user_id, label)} accessibilityLabel={`הסר את ${label}`} hitSlop={8}>
                      <Ionicons name="person-remove-outline" size={22} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {members.isLoading ? <Text muted style={{ padding: spacing.lg }}>טוען...</Text> : null}
          </Card>
        </Section>

        <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ gap: spacing.sm }}>
          {house ? <Button title="עזיבת הבית" variant="danger" onPress={confirmLeave} loading={leave.isPending} /> : null}
          <Button title="התנתקות" variant="secondary" onPress={confirmSignOut} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
