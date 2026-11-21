import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Button, Card, Chip, Screen, Text, useScreenPadding } from '@/components/ui';
import { useSession } from '@/lib/session';
import { uuid } from '@/lib/uuid';
import { radius, spacing, useTheme } from '@/theme';
import { useListMotion } from '@/theme/motion';
import type { HouseInfoItem, HouseInfoKind } from '@/types/database';
import { useAddInfo, useDeleteInfo, useInfoIsAdmin, useInfoItems, useUpdateInfo } from './hooks';
import { InfoSheet } from './InfoSheet';
import {
  QUICK_STARTS, canDeleteInfo, emptyInfoForm, maskValue, normalizeUrl, phoneToTel, relativeTimeText, type InfoForm,
} from './helpers';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_ICON: Record<HouseInfoKind, IconName> = {
  text: 'document-text-outline', wifi: 'wifi-outline', phone: 'call-outline', code: 'keypad-outline', link: 'link-outline',
};

type SheetState = { mode: 'add'; form: InfoForm } | { mode: 'edit'; id: string; form: InfoForm } | null;

function IconBtn({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6}
      style={{ width: 38, height: 38, borderRadius: radius.pill, backgroundColor: danger ? colors.dangerSoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

function InfoRow({ item, canDelete, onEdit, onDelete, onCopied }: {
  item: HouseInfoItem; canDelete: boolean; onEdit: () => void; onDelete: () => void; onCopied: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const shown = maskValue(item.value, item.is_secret, revealed);

  async function copy() {
    try {
      await Clipboard.setStringAsync(item.value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCopied(item.id);
    } catch {
      try { await Share.share({ message: item.value }); } catch { Alert.alert('שגיאה', 'לא הצלחנו להעתיק'); }
    }
  }
  function primary() {
    if (item.kind === 'phone') {
      const tel = phoneToTel(item.value);
      if (!tel) return Alert.alert('שגיאה', 'מספר הטלפון אינו תקין');
      Linking.openURL(`tel:${tel}`).catch(() => Alert.alert('שגיאה', 'לא ניתן לפתוח את החייגן'));
    } else if (item.kind === 'link') {
      const url = normalizeUrl(item.value);
      if (!url) return Alert.alert('שגיאה', 'הקישור אינו תקין');
      Linking.openURL(url).catch(() => Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור'));
    } else {
      copy();
    }
  }
  const primaryIcon: IconName = item.kind === 'phone' ? 'call' : item.kind === 'link' ? 'open-outline' : 'copy-outline';
  const primaryLabel = item.kind === 'phone' ? 'חיוג' : item.kind === 'link' ? 'פתיחת קישור' : item.kind === 'wifi' ? 'העתקת סיסמה' : 'העתקה';

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={KIND_ICON[item.kind]} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={2}>{item.label}</Text>
          <Text selectable={!item.is_secret || revealed} style={{ textAlign: 'left', writingDirection: 'ltr', alignSelf: 'flex-start' }}
            numberOfLines={revealed || item.kind === 'text' ? undefined : 2}>
            {shown}
          </Text>
        </View>
        {item.is_secret ? (
          <IconBtn icon={revealed ? 'eye-off-outline' : 'eye-outline'} label={revealed ? 'הסתר' : 'הצג'} onPress={() => setRevealed((r) => !r)} />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="small" muted style={{ flex: 1 }}>{relativeTimeText(item.updated_at)}</Text>
        {item.kind === 'phone' || item.kind === 'link' ? <IconBtn icon="copy-outline" label="העתקה" onPress={copy} /> : null}
        <IconBtn icon={primaryIcon} label={primaryLabel} onPress={primary} />
        <IconBtn icon="create-outline" label="עריכה" onPress={onEdit} />
        {canDelete ? <IconBtn icon="trash-outline" label="מחיקה" onPress={onDelete} danger /> : null}
      </View>
    </Card>
  );
}

export { ErrorBoundary } from 'expo-router';

/** מסך "מידע על הבית": עובדות משותפות לכל הדיירים. */
export default function InfoScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const isAdmin = useInfoIsAdmin();
  const q = useInfoItems();
  const add = useAddInfo();
  const update = useUpdateInfo();
  const del = useDeleteInfo();
  const motion = useListMotion(q.isSuccess);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const items = useMemo(() => q.data ?? [], [q.data]);

  const onCopied = useCallback((id: string) => {
    setToast(id);
    setTimeout(() => setToast((t) => (t === id ? null : t)), 1500);
  }, []);

  function save(form: InfoForm) {
    const current = sheet;
    setSheet(null);
    if (!current) return;
    const onError = () => Alert.alert('שגיאה', 'לא הצלחנו לשמור, נסו שוב');
    if (current.mode === 'add') add.mutate({ id: uuid(), ...form }, { onError });
    else update.mutate({ id: current.id, ...form }, { onError });
  }
  function confirmDelete(item: HouseInfoItem) {
    Alert.alert('מחיקה', `למחוק את "${item.label}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => del.mutate(item.id, { onError: () => Alert.alert('שגיאה', 'לא הצלחנו למחוק') }) },
    ]);
  }
  const openAdd = (preset?: Partial<InfoForm>) => setSheet({ mode: 'add', form: { ...emptyInfoForm, ...preset } });

  return (
    <Screen style={pad}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="חזרה"
          style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text variant="title" style={{ flex: 1 }}>מידע על הבית</Text>
        <IconBtn icon="add" label="הוספה" onPress={() => openAdd()} />
      </View>

      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : q.isError ? (
        <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
          <Text muted>לא הצלחנו לטעון את המידע</Text>
          <Button title="נסו שוב" variant="secondary" onPress={() => q.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Ionicons name="information-circle-outline" size={48} color={colors.textMuted} />
          <Text variant="heading" style={{ textAlign: 'center' }}>עוד אין מידע על הבית</Text>
          <Text muted style={{ textAlign: 'center' }}>שמרו כאן סיסמאות, טלפונים וקודים שכולם צריכים. התחילו ממשהו מהרשימה:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
            {QUICK_STARTS.map((s) => (
              <Chip key={s.label} label={s.label} onPress={() => openAdd({ label: s.label, kind: s.kind, is_secret: s.is_secret })} />
            ))}
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {items.map((item) => (
            <Animated.View key={item.id} entering={motion.entering} exiting={motion.exiting} layout={motion.layout}>
              <InfoRow item={item} canDelete={canDeleteInfo(item, userId, isAdmin)}
                onEdit={() => setSheet({ mode: 'edit', id: item.id, form: { label: item.label, value: item.value, kind: item.kind, is_secret: item.is_secret } })}
                onDelete={() => confirmDelete(item)} onCopied={onCopied} />
              {toast === item.id ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                  <Text variant="small" style={{ color: colors.bg }}>הועתק</Text>
                </View>
              ) : null}
            </Animated.View>
          ))}
        </ScrollView>
      )}

      {sheet ? (
        <InfoSheet title={sheet.mode === 'add' ? 'פריט חדש' : 'עריכת פריט'} initial={sheet.form}
          onClose={() => setSheet(null)} onSave={save} />
      ) : null}
    </Screen>
  );
}
