import { HouseHeader } from '@/features/house';
import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button, Card, Chip, EmptyState, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import { announcementTypeLabels, priorityLabels } from '@/lib/labels';
import { useSession } from '@/lib/session';
import type { Announcement, AnnouncementType, Priority } from '@/types/database';
import { useAddAnnouncement, useAnnouncements, useDeleteAnnouncement, useIsAdmin } from './hooks';
import { canDeleteAnnouncement, formatEventDate, parseEventDate, shiftDate, todayISO } from './helpers';

const types = Object.keys(announcementTypeLabels) as AnnouncementType[];
const priorities: Priority[] = ['low', 'normal', 'high'];
const typeIcon: Record<AnnouncementType, string> = { general: '📢', event: '🎉', reminder: '⏰', visit: '🚪' };

export default function AnnouncementsScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const { session } = useSession();
  const isAdmin = useIsAdmin();
  const { data, isLoading, refetch, isRefetching } = useAnnouncements();
  const del = useDeleteAnnouncement();
  const [open, setOpen] = useState(false);

  const confirmDelete = (a: Announcement) =>
    Alert.alert('מחיקת מודעה', `למחוק את "${a.title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); del.mutate(a.id); } },
    ]);

  return (
    <Screen style={pad}>
      <HouseHeader />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text variant="title">מודעות</Text>
        <Button title="+ מודעה חדשה" onPress={() => setOpen(true)} style={{ paddingVertical: 10 }} />
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 120 }}
        ListEmptyComponent={isLoading ? undefined : <EmptyState title="אין מודעות" hint="הוסיפו את המודעה הראשונה לבית" />}
        renderItem={({ item: a }) => {
          const high = a.priority === 'high';
          return (
            <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut} layout={LinearTransition.springify().damping(18)}>
              <Card style={[
                { gap: spacing.sm },
                high && { borderColor: colors.danger, borderWidth: 2, backgroundColor: colors.dangerSoft },
                a.priority === 'low' && { opacity: 0.85 },
              ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text variant="small" style={{ color: colors.primary, fontWeight: '700' }}>
                      {typeIcon[a.type]} {announcementTypeLabels[a.type]}
                    </Text>
                  </View>
                  {high ? (
                    <View style={{ backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text variant="small" style={{ color: '#fff', fontWeight: '700' }}>עדיפות {priorityLabels.high}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  {canDeleteAnnouncement(a, session?.user.id, isAdmin) ? (
                    <Pressable hitSlop={10} accessibilityLabel="מחק" onPress={() => confirmDelete(a)}>
                      <Text style={{ color: colors.danger, fontWeight: '600' }}>מחק</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text variant="heading">{a.title}</Text>
                {a.body ? <Text muted>{a.body}</Text> : null}
                {a.event_date ? (
                  <Text variant="label" style={{ color: colors.primary }}>📅 {formatEventDate(a.event_date)}</Text>
                ) : null}
              </Card>
            </Animated.View>
          );
        }}
      />
      <AddModal visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function AddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const add = useAddAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<AnnouncementType>('general');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dateText, setDateText] = useState('');

  const parsed = parseEventDate(dateText);
  const dateInvalid = dateText.trim() !== '' && !parsed;
  const canSave = title.trim().length > 0 && !dateInvalid;

  const reset = () => { setTitle(''); setBody(''); setType('general'); setPriority('normal'); setDateText(''); };
  const save = () => {
    add.mutate({ title: title.trim(), body: body.trim() || null, type, priority, event_date: parsed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    reset();
    onClose();
  };
  const step = (days: number) => setDateText(shiftDate(parsed ?? todayISO(), days));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">מודעה חדשה</Text>
          <Input label="כותרת" value={title} onChangeText={setTitle} placeholder="על מה המודעה?" />
          <Input label="תוכן" value={body} onChangeText={setBody} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted>סוג</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {types.map((t) => <Chip key={t} label={announcementTypeLabels[t]} selected={type === t} onPress={() => setType(t)} />)}
            </View>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted>עדיפות</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {priorities.map((p) => <Chip key={p} label={priorityLabels[p]} selected={priority === p} onPress={() => setPriority(p)} />)}
            </View>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted>תאריך אירוע (אופציונלי)</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Chip label="+" onPress={() => step(1)} />
              <Input value={dateText} onChangeText={setDateText} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" style={{ minWidth: 150, textAlign: 'center' }} />
              <Chip label="−" onPress={() => step(-1)} />
              {dateText ? <Chip label="נקה" onPress={() => setDateText('')} /> : null}
            </View>
            {dateInvalid ? <Text variant="small" style={{ color: colors.danger }}>תאריך לא תקין, יש להזין בפורמט YYYY-MM-DD</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="פרסם" onPress={save} disabled={!canSave} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
