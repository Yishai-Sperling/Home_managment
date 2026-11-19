import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Screen, Text, useScreenPadding } from '@/components/ui';
import { HouseHeader, useCurrentHouse } from '@/features/house';
import { useShoppingItems } from '@/features/shopping/hooks';
import { useReservations, useHouseDirectory } from '@/features/car/hooks';
import { currentReservation, reservationsToday } from '@/features/car/overlap';
import { useAnnouncements } from '@/features/announcements/hooks';
import { useIssues } from '@/features/issues/hooks';
import { announcementTypeLabels } from '@/lib/labels';
import { spacing, useTheme } from '@/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

function Stat({ icon, value, label, tint, onPress, delay }: { icon: Icon; value: number | string; label: string; tint: string; onPress: () => void; delay: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ flex: 1 }}>
      <Pressable onPress={onPress}>
        <Card style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={20} color={tint} />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700' }}>{value}</Text>
          <Text variant="small" muted>{label}</Text>
        </Card>
      </Pressable>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { houseId, house } = useCurrentHouse();
  const shopping = useShoppingItems(houseId, 'pending');
  const reservations = useReservations(houseId);
  const directory = useHouseDirectory(houseId);
  const announcements = useAnnouncements();
  const issues = useIssues('all');

  const now = new Date();
  const list = reservations.data ?? [];
  const current = currentReservation(list, now);
  const today = reservationsToday(list, now);
  const names = directory.data?.names ?? {};
  const openIssues = (issues.data ?? []).filter((i) => i.status !== 'closed');
  const recentAnn = (announcements.data ?? []).slice(0, 3);

  const activity = (() => {
    const rows: { id: string; icon: Icon; text: string; at: string }[] = [];
    (shopping.data ?? []).slice(0, 5).forEach((i) => rows.push({ id: 's' + i.id, icon: 'cart', text: `נוסף לקניות: ${i.name}`, at: i.created_at }));
    list.slice(0, 5).forEach((r) => rows.push({ id: 'r' + r.id, icon: 'car', text: `שריון רכב: ${names[r.user_id] ?? 'דייר'}`, at: r.created_at }));
    (announcements.data ?? []).slice(0, 5).forEach((a) => rows.push({ id: 'a' + a.id, icon: 'megaphone', text: `מודעה: ${a.title}`, at: a.created_at }));
    (issues.data ?? []).slice(0, 5).forEach((i) => rows.push({ id: 'i' + i.id, icon: 'construct', text: `תקלה: ${i.title}`, at: i.created_at }));
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6);
  })();

  const refreshing = shopping.isRefetching || reservations.isRefetching;
  const refresh = () => qc.invalidateQueries();

  return (
    <Screen style={pad}>
      <HouseHeader />
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text variant="title">{house?.name ? `שלום, ${house.name}` : 'בית'}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Stat delay={0} icon="cart" tint={colors.primary} value={shopping.data?.length ?? 0} label="פריטים לקנייה" onPress={() => router.push('/shopping')} />
          <Stat delay={60} icon="construct" tint={openIssues.length ? colors.warning : colors.success} value={openIssues.length} label="תקלות פתוחות" onPress={() => router.push('/issues')} />
        </View>

        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Pressable onPress={() => router.push('/car')}>
            <Card style={{ backgroundColor: current ? colors.warningSoft : colors.successSoft, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="car-sport" size={30} color={current ? colors.warning : colors.success} />
                <View style={{ flex: 1 }}>
                  <Text variant="heading">{current ? 'הרכב תפוס' : 'הרכב זמין'}</Text>
                  {current ? <Text variant="small" muted>{names[current.user_id] ?? 'דייר'} עד {fmt(current.ends_at)}</Text> : null}
                </View>
              </View>
              <Text variant="small" muted>
                {today.length ? `שריונים היום: ${today.map((r) => `${fmt(r.starts_at)}–${fmt(r.ends_at)}`).join(' · ')}` : 'אין שריונים להיום'}
              </Text>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()} style={{ gap: spacing.sm }}>
          <Text variant="heading">מודעות חדשות</Text>
          {recentAnn.length === 0 ? <Text muted>אין מודעות חדשות</Text> : recentAnn.map((a) => (
            <Pressable key={a.id} onPress={() => router.push('/announcements')}>
              <Card style={{ gap: 2, borderColor: a.priority === 'high' ? colors.danger : colors.border }}>
                <Text variant="label">{a.title}</Text>
                <Text variant="small" muted>{announcementTypeLabels[a.type]} · {fmtDay(a.created_at)}</Text>
              </Card>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).springify()} style={{ gap: spacing.sm }}>
          <Text variant="heading">פעילות אחרונה</Text>
          <Card style={{ gap: spacing.md }}>
            {activity.length === 0 ? <Text muted>עדיין אין פעילות</Text> : activity.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name={r.icon} size={18} color={colors.textMuted} />
                <Text style={{ flex: 1 }} numberOfLines={1}>{r.text}</Text>
                <Text variant="small" muted>{fmtDay(r.at)}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Pressable onPress={() => router.push('/settings')} style={{ alignSelf: 'stretch' }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="people" size={22} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>חברי הבית</Text>
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
