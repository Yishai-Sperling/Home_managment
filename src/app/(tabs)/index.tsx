import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Screen, Text, useScreenPadding } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { HouseHeader, useCurrentHouse } from '@/features/house';
import { useProfile, useSession } from '@/lib/session';
import { useShoppingItems } from '@/features/shopping/hooks';
import { useReservations, useHouseDirectory } from '@/features/car/hooks';
import { useMaterializeRecurring } from '@/features/car/useMaterialize';
import { currentReservation, reservationsToday } from '@/features/car/overlap';
import { useAnnouncements } from '@/features/announcements/hooks';
import { useIssues } from '@/features/issues/hooks';
import { buildActivity, relativeDayLabel, relativeTime, upcomingEvents, urgentOpenIssues, type ActivityKind } from '@/features/dashboard/summary';
import { spacing, useTheme } from '@/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const kindIcon: Record<ActivityKind, Icon> = { shopping: 'cart', car: 'car', announcement: 'megaphone', issue: 'construct' };

function Stat({ icon, value, label, tint, onPress }: { icon: Icon; value: number | string; label: string; tint: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>{value}</Text>
        <Text variant="small" muted>{label}</Text>
      </Card>
    </Pressable>
  );
}

function SectionTitle({ children, onPress }: { children: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Text variant="heading">{children}</Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const pad = useScreenPadding();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { houseId } = useCurrentHouse();
  const { session } = useSession();
  const profile = useProfile().data;
  const firstName = (profile?.full_name?.trim().split(/\s+/)[0]) || session?.user.email?.split('@')[0] || '';
  useMaterializeRecurring(houseId);
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
  const nameOf = (id: string) => names[id] ?? 'דייר';
  const openIssues = (issues.data ?? []).filter((i) => i.status !== 'closed');
  const urgent = urgentOpenIssues(issues.data ?? []);
  const events = upcomingEvents(announcements.data ?? [], now);
  const activity = buildActivity(
    { shopping: shopping.data, reservations: list, announcements: announcements.data, issues: issues.data },
    names, 6,
  );

  const refreshing = shopping.isRefetching || reservations.isRefetching || announcements.isRefetching || issues.isRefetching;
  const refresh = () => qc.invalidateQueries();

  return (
    <Screen style={pad}>
      <HouseHeader />
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text variant="title">{firstName ? `שלום, ${firstName}` : 'שלום'}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Stat icon="cart" tint={colors.primary} value={shopping.data?.length ?? 0} label="פריטים לקנייה" onPress={() => router.push('/shopping')} />
          <Stat icon="construct" tint={openIssues.length ? colors.warning : colors.success} value={openIssues.length} label="תקלות פתוחות" onPress={() => router.push('/issues')} />
        </View>

        <Pressable onPress={() => router.push('/car')}>
          <Card style={{ backgroundColor: current ? colors.warningSoft : colors.successSoft, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="car-sport" size={30} color={current ? colors.warning : colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{current ? 'הרכב תפוס עכשיו' : 'הרכב זמין'}</Text>
                {current ? <Text variant="small" muted>{nameOf(current.user_id)} עד {fmt(current.ends_at)}</Text> : null}
              </View>
            </View>
            {today.length === 0 ? <Text variant="small" muted>אין שריונים להיום</Text> : today.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar name={nameOf(r.user_id)} id={r.user_id} size={26} />
                <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>{nameOf(r.user_id)}</Text>
                <Text variant="small" muted>{fmt(r.starts_at)}–{fmt(r.ends_at)}</Text>
              </View>
            ))}
          </Card>
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle>היום בבית</SectionTitle>

          {urgent.map((i) => (
            <Pressable key={i.id} onPress={() => router.push('/issues')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
                <Ionicons name="alert-circle" size={22} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={{ color: colors.danger }} numberOfLines={1}>{i.title}</Text>
                  <Text variant="small" muted>תקלה דחופה</Text>
                </View>
              </Card>
            </Pressable>
          ))}

          <Pressable onPress={() => router.push('/announcements')}>
            <Card style={{ gap: spacing.sm }}>
              <Text variant="label">אירועים קרובים (7 ימים)</Text>
              {events.length === 0 ? <Text variant="small" muted>אין אירועים קרובים</Text> : events.map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={{ flex: 1 }} numberOfLines={1}>{a.title}</Text>
                  <Text variant="small" muted>{relativeDayLabel(a.event_date!, now)} · {fmt(a.event_date!)}</Text>
                </View>
              ))}
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push('/shopping')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="cart" size={18} color={colors.primary} />
              <Text style={{ flex: 1 }}>{(shopping.data?.length ?? 0) > 0 ? `${shopping.data!.length} פריטים ממתינים לקנייה` : 'אין פריטים לקנייה'}</Text>
              <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle>פעילות אחרונה</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            {activity.length === 0 ? <Text muted>עדיין אין פעילות</Text> : activity.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar name={r.actorName} id={r.actorId} size={32} />
                <View style={{ flex: 1 }}>
                  <Text variant="small" style={{ fontWeight: '600' }} numberOfLines={1}>{r.actorName}</Text>
                  <Text variant="small" muted numberOfLines={1}>{r.text}</Text>
                </View>
                <Ionicons name={kindIcon[r.kind]} size={14} color={colors.textMuted} />
                <Text variant="small" muted>{relativeTime(r.at, now)}</Text>
              </View>
            ))}
          </Card>
        </View>

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
