import { HouseHeader } from '@/features/house';
import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useListMotion } from '@/theme/motion';
import { uuid } from '@/lib/uuid';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
import { Button, Card, Chip, EmptyState, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import { announcementTypeLabels, priorityLabels } from '@/lib/labels';
import { useSession } from '@/lib/session';
import type { Announcement, AnnouncementType, Priority } from '@/types/database';
import { useAddAnnouncement, useAnnouncements, useDeleteAnnouncement, useIsAdmin, useMemberNames, useUpdateAnnouncement } from './hooks';
import {
  announcementToForm, canDeleteAnnouncement, canEditAnnouncement, emptyAnnouncementForm, formatEventDate,
  formToAnnouncementFields, parseEventDate, shiftDate, todayISO, type AnnouncementForm as AnnouncementFormState,
} from './helpers';

const types = Object.keys(announcementTypeLabels) as AnnouncementType[];
const priorities: Priority[] = ['low', 'normal', 'high'];
const typeIcon: Record<AnnouncementType, string> = { general: '📢', event: '🎉', reminder: '⏰', visit: '🚪' };

export default function AnnouncementsScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const { session } = useSession();
  const isAdmin = useIsAdmin();
  const { data, isLoading, refetch, isRefetching } = useAnnouncements();
  const motion = useListMotion(!isLoading);
  const del = useDeleteAnnouncement();
  const names = useMemberNames();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

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
            <Animated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout}>
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
                  {canEditAnnouncement(a, session?.user.id, isAdmin) ? (
                    <Pressable hitSlop={10} accessibilityLabel="ערוך" onPress={() => setEditing(a)}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>ערוך</Text>
                    </Pressable>
                  ) : null}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar name={names.get(a.created_by)} id={a.created_by} size={22} />
                  <Text variant="small" muted>{names.get(a.created_by) ?? 'דייר'}</Text>
                </View>
              </Card>
            </Animated.View>
          );
        }}
      />
      <FormModal visible={open} onClose={() => setOpen(false)} />
      <FormModal visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function FormModal({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Announcement | null }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
        {visible ? <AnnouncementForm key={editing?.id ?? 'new'} editing={editing} onClose={onClose} /> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AnnouncementForm({ onClose, editing }: { onClose: () => void; editing?: Announcement | null }) {
  const { colors } = useTheme();
  const add = useAddAnnouncement();
  const update = useUpdateAnnouncement();
  const [form, setForm] = useState<AnnouncementFormState>(() => (editing ? announcementToForm(editing) : emptyAnnouncementForm));
  const { title, body, type, priority, dateText } = form;
  const setTitle = (v: string) => setForm((f) => ({ ...f, title: v }));
  const setBody = (v: string) => setForm((f) => ({ ...f, body: v }));
  const setType = (v: AnnouncementType) => setForm((f) => ({ ...f, type: v }));
  const setPriority = (v: Priority) => setForm((f) => ({ ...f, priority: v }));
  const setDateText = (v: string) => setForm((f) => ({ ...f, dateText: v }));

  const parsed = parseEventDate(dateText);
  const dateInvalid = dateText.trim() !== '' && !parsed;
  const canSave = title.trim().length > 0 && !dateInvalid;

  const save = () => {
    const fields = formToAnnouncementFields(form);
    if (!fields) return;
    if (editing) update.mutate({ id: editing.id, ...fields });
    else add.mutate({ id: uuid(), ...fields });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };
  const step = (days: number) => setDateText(shiftDate(parsed ?? todayISO(), days));

  return (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">{editing ? 'עריכת מודעה' : 'מודעה חדשה'}</Text>
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
            <Button title={editing ? 'שמור' : 'פרסם'} onPress={save} disabled={!canSave} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </ScrollView>
  );
}
