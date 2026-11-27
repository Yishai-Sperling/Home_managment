import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button, Card, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { roleLabels } from '@/lib/labels';
import { unregisterPush } from '@/features/notifications/registerPush';
import { NOTIFY_PREF_LABELS, useNotifyPrefs } from '@/features/notifications/prefs';
import { Avatar } from '@/components/Avatar';
import { ToothbrushIcon, ToothbrushPicker, brushColorName, isBrushColor, takenByOthers, useSetToothbrushColor } from '@/features/house/toothbrush';
import { AutoPresenceSection } from '@/features/geofence/AutoPresenceSection';
import { disableAutoPresence } from '@/features/geofence/service';
import { supabase } from '@/lib/supabase';
import { useProfile, useSession } from '@/lib/session';
import { useCurrentHouse, useHouseMembers, useHouses, useLeaveHouse, useRemoveMember, useUpdateProfile } from '@/features/house/hooks';
import { houseAdminErrorMessage, useDeleteHouse, useSetMemberRole } from '@/features/house/admin';
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
  const setBrush = useSetToothbrushColor();
  const [brushOpen, setBrushOpen] = useState(false);
  const chevron = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevron.value * 180}deg` }] }));
  const toggleBrush = (open: boolean) => { setBrushOpen(open); chevron.value = withTiming(open ? 1 : 0, { duration: 220 }); };
  const myBrush = members.data?.find((m) => m.user_id === session?.user.id)?.profile?.toothbrush_color ?? null;
  const takenBrush = takenByOthers(members.data ?? [], session?.user.id);
  const updateProfile = useUpdateProfile();
  const removeMember = useRemoveMember();
  const leave = useLeaveHouse();
  const houses = useHouses();
  const setRole = useSetMemberRole(house?.id ?? null);
  const deleteHouse = useDeleteHouse();
  const { prefs, setPref, isError: prefsError } = useNotifyPrefs();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');

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

  function changeRole(userId: string, label: string, role: 'admin' | 'member', isMe: boolean) {
    const run = () => setRole.mutate({ userId, role }, {
      onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
      onError: (e) => Alert.alert('שגיאה', houseAdminErrorMessage(e, 'עדכון התפקיד נכשל')),
    });
    const msg = role === 'admin' ? `למנות את ${label} למנהל?` : isMe ? 'להסיר את תפקיד המנהל שלך?' : `להסיר את תפקיד המנהל של ${label}?`;
    Alert.alert('שינוי תפקיד', msg, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'אישור', style: role === 'member' ? 'destructive' : 'default', onPress: run },
    ]);
  }

  function confirmDeleteHouse() {
    if (!house) return;
    Alert.alert('מחיקת הבית', `הבית "${house.name}" וכל הנתונים שבו יימחקו לצמיתות לכל הדיירים. להמשיך?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק לצמיתות', style: 'destructive',
        onPress: () => {
          const next = houses.data?.find((h) => h.id !== house.id)?.id ?? null;
          deleteHouse.mutate({ houseId: house.id, nextHouseId: next }, {
            onSuccess: () => { setDeleteOpen(false); setDeleteText(''); router.replace('/'); },
            onError: (e) => Alert.alert('שגיאה', houseAdminErrorMessage(e, 'מחיקת הבית נכשלה')),
          });
        },
      },
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
      { text: 'התנתק', style: 'destructive', onPress: async () => { await unregisterPush(); await disableAutoPresence(); await supabase.auth.signOut(); } },
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

        <Section title="מי בבית: זיהוי אוטומטי" delay={20}>
          <AutoPresenceSection />
        </Section>

        <Section title="מברשת השיניים שלי" delay={40}>
          <Animated.View layout={LinearTransition.duration(240)} style={{ overflow: 'hidden', borderRadius: radius.lg }}>
          <Card style={{ gap: spacing.md }}>
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); toggleBrush(!brushOpen); }}
              accessibilityLabel="פתיחה וסגירה של בורר צבע המברשת"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {isBrushColor(myBrush) ? <ToothbrushIcon color={myBrush} size={30} /> : <Ionicons name="color-palette-outline" size={26} color={colors.textMuted} />}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{isBrushColor(myBrush) ? brushColorName(myBrush) : 'לא נבחר צבע'}</Text>
                <Text variant="small" muted>{brushOpen ? 'לחיצה על הצבע שנבחר מנקה אותו' : 'לחץ כדי לבחור צבע'}</Text>
              </View>
              <Animated.View style={chevronStyle}><Ionicons name="chevron-down" size={20} color={colors.textMuted} /></Animated.View>
            </Pressable>
            {brushOpen ? (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
              <ToothbrushPicker
                value={myBrush}
                taken={takenBrush}
                disabled={setBrush.isPending}
                onChange={(hex) => {
                  setBrush.mutate(hex, { onError: () => Alert.alert('שגיאה', 'לא הצלחנו לשמור את הצבע, נסו שוב') });
                  toggleBrush(false);
                }}
              />
              </Animated.View>
            ) : null}
          </Card>
          </Animated.View>
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
                  <Avatar name={label} id={m.user_id} size={40} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ fontWeight: '600' }}>{label}{isMe ? ' (אני)' : ''}</Text>
                      {isBrushColor(m.profile?.toothbrush_color) ? <ToothbrushIcon color={m.profile!.toothbrush_color!} size={18} /> : null}
                    </View>
                    <Text variant="small" muted>{roleLabels[m.role]}{m.profile?.phone ? ` · ${m.profile.phone}` : ''}</Text>
                  </View>
                  {m.role === 'admin' ? (
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                      <Text variant="small" style={{ color: colors.primary, fontWeight: '700' }}>מנהל</Text>
                    </View>
                  ) : null}
                  {isAdmin ? (
                    <Pressable
                      onPress={() => changeRole(m.user_id, label, m.role === 'admin' ? 'member' : 'admin', isMe)}
                      accessibilityLabel={m.role === 'admin' ? `הסר הרשאת מנהל מ${label}` : `מנה את ${label} למנהל`}
                      hitSlop={8}>
                      <Ionicons name={m.role === 'admin' ? 'shield-outline' : 'shield-checkmark-outline'} size={22} color={colors.primary} />
                    </Pressable>
                  ) : null}
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

        <Section title="התראות" delay={200}>
          <Card style={{ padding: 0 }}>
            {NOTIFY_PREF_LABELS.map(({ key, label }, i) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                <Text style={{ fontWeight: '600' }}>{label}</Text>
                <Switch
                  value={prefs[key]}
                  onValueChange={(v) => { Haptics.selectionAsync().catch(() => {}); setPref(key, v); }}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel={`התראות ${label}`}
                />
              </View>
            ))}
          </Card>
          <Text variant="small" muted>תזכורות לפני שריון הרכב שלך ולפני אירועים</Text>
          {prefsError ?<Text variant="small" style={{ color: colors.danger }}>שמירת ההעדפות נכשלה, נסו שוב</Text> : null}
        </Section>

        <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ gap: spacing.sm }}>
          {house ? <Button title="עזיבת הבית" variant="danger" onPress={confirmLeave} loading={leave.isPending} /> : null}
          <Button title="התנתקות" variant="secondary" onPress={confirmSignOut} />
        </Animated.View>

        {house && isAdmin ? (
          <Section title="אזור מסוכן" delay={300}>
            <Card style={{ gap: spacing.md, borderColor: colors.danger }}>
              <Text variant="small" muted>מחיקת הבית תסיר אותו ואת כל הנתונים שלו (קניות, רכב, מודעות, תקלות) מכל הדיירים. אי אפשר לשחזר.</Text>
              {deleteOpen ? (
                <>
                  <Input label={`להמשך, הקלידו את שם הבית: ${house.name}`} value={deleteText} onChangeText={setDeleteText} autoCorrect={false} />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button title="ביטול" variant="secondary" onPress={() => { setDeleteOpen(false); setDeleteText(''); }} style={{ flex: 1 }} />
                    <Button title="מחק את הבית" variant="danger" onPress={confirmDeleteHouse} disabled={deleteText.trim() !== house.name.trim()} loading={deleteHouse.isPending} style={{ flex: 1 }} />
                  </View>
                </>
              ) : (
                <Button title="מחיקת הבית" variant="danger" onPress={() => setDeleteOpen(true)} />
              )}
            </Card>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
