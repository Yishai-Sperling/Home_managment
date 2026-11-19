import React, { useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Chip, EmptyState, Input, Screen, Text, useScreenPadding } from '@/components/ui';
import { radius, spacing, useTheme, type Colors } from '@/theme';
import { issueCategoryLabels, issueStatusLabels, issueUrgencyLabels } from '@/lib/labels';
import type { Issue, IssueCategory, IssueStatus, IssueUrgency } from '@/types/database';
import {
  memberName, useAssignIssue, useDeleteIssue, useIssueHouseMembers, useIssueImageUrl, useIssues,
  useReportIssue, useUpdateIssueStatus,
} from './hooks';
import type { IssueFilter } from './helpers';

const categories = Object.keys(issueCategoryLabels) as IssueCategory[];
const urgencies: IssueUrgency[] = ['low', 'normal', 'urgent'];
const statuses: IssueStatus[] = ['open', 'in_progress', 'closed'];
const filters: IssueFilter[] = ['all', ...statuses];

function urgencyColors(u: IssueUrgency, c: Colors) {
  return { urgent: [c.danger, '#fff'], normal: [c.warningSoft, c.warning], low: [c.surfaceAlt, c.textMuted] }[u];
}
function statusColors(s: IssueStatus, c: Colors) {
  return { open: [c.dangerSoft, c.danger], in_progress: [c.warningSoft, c.warning], closed: [c.successSoft, c.success] }[s];
}

function Badge({ label, colors }: { label: string; colors: string[] }) {
  return (
    <View style={{ backgroundColor: colors[0], borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text variant="small" style={{ color: colors[1], fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export default function IssuesScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<IssueFilter>('all');
  const { data, isLoading, refetch, isRefetching } = useIssues(filter);
  const members = useIssueHouseMembers().data ?? [];
  const [reporting, setReporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.find((i) => i.id === selectedId) ?? null;

  return (
    <Screen style={pad}>
      {/* HOUSE_HEADER_SLOT: <HouseHeader /> מגיע מ-@/features/house */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text variant="title">תקלות</Text>
        <Button title="+ דיווח" onPress={() => setReporting(true)} style={{ paddingVertical: 10 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {filters.map((f) => (
          <Chip key={f} label={f === 'all' ? 'הכל' : issueStatusLabels[f]} selected={filter === f} onPress={() => { Haptics.selectionAsync().catch(() => {}); setFilter(f); }} />
        ))}
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 120 }}
        ListEmptyComponent={isLoading ? undefined : <EmptyState title="אין תקלות" hint="הכל תקין בבית" />}
        renderItem={({ item: i }) => {
          const assignee = members.find((m) => m.user_id === i.assignee_id);
          return (
            <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut} layout={LinearTransition.springify().damping(18)}>
              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedId(i.id); }}>
                <Card style={[{ gap: spacing.sm }, i.urgency === 'urgent' && i.status !== 'closed' && { borderColor: colors.danger, borderWidth: 2 }, i.status === 'closed' && { opacity: 0.65 }]}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Badge label={issueStatusLabels[i.status]} colors={statusColors(i.status, colors)} />
                    <Badge label={issueUrgencyLabels[i.urgency]} colors={urgencyColors(i.urgency, colors)} />
                    <Badge label={issueCategoryLabels[i.category]} colors={[colors.primarySoft, colors.primary]} />
                  </View>
                  <Text variant="heading">{i.title}</Text>
                  {i.description ? <Text muted numberOfLines={2}>{i.description}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {assignee ? <Text variant="small" muted>👤 {memberName(assignee)}</Text> : null}
                    {i.image_path ? <Text variant="small" muted>📷 תמונה</Text> : null}
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          );
        }}
      />
      <ReportModal visible={reporting} onClose={() => setReporting(false)} />
      <DetailModal issue={selected} onClose={() => setSelectedId(null)} />
    </Screen>
  );
}

function ReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const report = useReportIssue();
  const members = useIssueHouseMembers().data ?? [];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('general');
  const [urgency, setUrgency] = useState<IssueUrgency>('normal');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.5, allowsEditing: false, exif: false };
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('אין הרשאת מצלמה');
      }
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled) setImageUri(res.assets[0].uri);
    } catch {
      Alert.alert('לא ניתן לבחור תמונה');
    }
  };

  const reset = () => { setTitle(''); setDescription(''); setCategory('general'); setUrgency('normal'); setAssignee(null); setImageUri(null); };
  const save = () => {
    report.mutate(
      { title: title.trim(), description: description.trim() || null, category, urgency, assignee_id: assignee, imageUri },
      { onError: () => Alert.alert('שליחת הדיווח נכשלה') },
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="title">דיווח על תקלה</Text>
          <Input label="כותרת" value={title} onChangeText={setTitle} placeholder="מה התקלה?" />
          <Input label="תיאור" value={description} onChangeText={setDescription} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
          <ChipRow label="קטגוריה" items={categories} labels={issueCategoryLabels} value={category} onChange={setCategory} />
          <ChipRow label="דחיפות" items={urgencies} labels={issueUrgencyLabels} value={urgency} onChange={setUrgency} />
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted>אחראי לטיפול (אופציונלי)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label="ללא" selected={assignee === null} onPress={() => setAssignee(null)} />
              {members.map((m) => <Chip key={m.user_id} label={memberName(m)} selected={assignee === m.user_id} onPress={() => setAssignee(m.user_id)} />)}
            </View>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted>תמונה</Text>
            {imageUri ? <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, borderRadius: radius.md }} resizeMode="cover" /> : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip label="📷 צלם" onPress={() => pick(true)} />
              <Chip label="🖼 גלריה" onPress={() => pick(false)} />
              {imageUri ? <Chip label="הסר" onPress={() => setImageUri(null)} /> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="שלח דיווח" onPress={save} disabled={!title.trim()} style={{ flex: 1 }} />
            <Button title="ביטול" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChipRow<T extends string>({ label, items, labels, value, onChange }:
  { label: string; items: T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((it) => <Chip key={it} label={labels[it]} selected={value === it} onPress={() => onChange(it)} />)}
      </View>
    </View>
  );
}

function DetailModal({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  const { colors } = useTheme();
  const members = useIssueHouseMembers().data ?? [];
  const setStatus = useUpdateIssueStatus();
  const assign = useAssignIssue();
  const del = useDeleteIssue();
  const img = useIssueImageUrl(issue?.image_path ?? null);

  const confirmDelete = () => {
    if (!issue) return;
    Alert.alert('מחיקת תקלה', `למחוק את "${issue.title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => { del.mutate(issue); onClose(); } },
    ]);
  };

  return (
    <Modal visible={!!issue} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {issue ? (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Badge label={issueUrgencyLabels[issue.urgency]} colors={urgencyColors(issue.urgency, colors)} />
              <Badge label={issueCategoryLabels[issue.category]} colors={[colors.primarySoft, colors.primary]} />
            </View>
            <Text variant="title">{issue.title}</Text>
            {issue.description ? <Text>{issue.description}</Text> : null}
            {img.data ? <Image source={{ uri: img.data }} style={{ width: '100%', height: 240, borderRadius: radius.md }} resizeMode="cover" /> : null}
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" muted>סטטוס</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {statuses.map((s) => (
                  <Chip key={s} label={issueStatusLabels[s]} selected={issue.status === s}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setStatus.mutate({ id: issue.id, status: s }); }} />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" muted>אחראי לטיפול</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Chip label="ללא" selected={issue.assignee_id === null} onPress={() => assign.mutate({ id: issue.id, assignee_id: null })} />
                {members.map((m) => (
                  <Chip key={m.user_id} label={memberName(m)} selected={issue.assignee_id === m.user_id}
                    onPress={() => assign.mutate({ id: issue.id, assignee_id: m.user_id })} />
                ))}
              </View>
            </View>
            <Button title="מחק תקלה" variant="danger" onPress={confirmDelete} />
            <Button title="סגור" variant="secondary" onPress={onClose} />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}
