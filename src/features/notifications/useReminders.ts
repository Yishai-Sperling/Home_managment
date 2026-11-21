import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProfile, useSession } from '@/lib/session';
import { mergePrefs } from './mergePrefs';
import { planReminders, type ReminderEvent, type ReminderReservation } from './reminderPlan';

const PREFIX = 'reminder:';
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Expo Go וסימולטור לא נתמכים (אותה בדיקה כמו ב-registerPush). */
function supported() {
  return Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

interface ReminderData {
  reservations: ReminderReservation[];
  events: ReminderEvent[];
}

/** מבטל תזכורות מתוזמנות (מזהה שמתחיל ב-reminder:) שאינן ב-keep. */
async function cancelAll(keep: Set<string> = new Set()) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX) && !keep.has(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

async function reconcile(plan: ReturnType<typeof planReminders>) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'התראות הבית',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    });
  }
  await cancelAll(new Set(plan.map((p) => p.id)));
  // מזהה זהה מחליף את ההתראה הקיימת, ולכן תזמון חוזר בטוח
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { screen: p.screen }, sound: true },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: p.at, channelId: 'default' },
    });
  }
}

/**
 * תזכורות מקומיות: 30 דקות לפני שריון רכב שלי ושעה לפני אירועי מודעות (או 09:00 ביום האירוע).
 * `enabled` = משתמש מחובר ובית פעיל. לא מבקש הרשאה (registerPush עושה זאת) ולא זורק שגיאות.
 */
export function useReminders(enabled: boolean) {
  const { session } = useSession();
  const uid = session?.user.id;
  const profile = useProfile().data;
  const houseId = profile?.current_house_id ?? null;
  const prefOn = mergePrefs(profile?.notify_prefs).reminders;
  const active = enabled && !!uid && !!houseId && prefOn && supported();

  const query = useQuery({
    queryKey: ['reminders-source', uid, houseId],
    enabled: active,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ReminderData> => {
      const from = new Date();
      // אירוע ללא שעה נשמר בחצות ועלול להיות כבר "בעבר" היום, אבל התזכורת שלו ב-09:00: מתחילים מתחילת היום
      const dayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      const to = new Date(from.getTime() + WINDOW_MS);
      const [cars, anns] = await Promise.all([
        supabase.from('car_reservations').select('id, starts_at, ends_at, purpose')
          .eq('house_id', houseId!).eq('user_id', uid!)
          .gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()),
        supabase.from('announcements').select('id, title, event_date')
          .eq('house_id', houseId!)
          .gte('event_date', new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .lte('event_date', to.toISOString()),
      ]);
      if (cars.error) throw cars.error;
      if (anns.error) throw anns.error;
      return { reservations: (cars.data ?? []) as ReminderReservation[], events: (anns.data ?? []) as ReminderEvent[] };
    },
  });
  const data = query.data;
  const refetch = query.refetch;

  const plan = useMemo(() => (data ? planReminders({ ...data, now: new Date() }) : null), [data]);
  const planRef = useRef(plan);
  const activeRef = useRef(active);
  useEffect(() => {
    planRef.current = plan;
    activeRef.current = active;
  }, [plan, active]);

  const run = useCallback(async () => {
    try {
      if (!supported()) return;
      if (!activeRef.current) {
        await cancelAll();
        return;
      }
      const p = planRef.current;
      if (p) await reconcile(p.filter((r) => r.at.getTime() > Date.now()));
    } catch {
      // תזכורות לעולם לא מפילות את האפליקציה
    }
  }, []);

  // כשאין משתמש/בית (התנתקות) active=false ולכן הכל מתבטל
  useEffect(() => { run(); }, [run, plan, active]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (activeRef.current) refetch().catch(() => {});
      run();
    });
    return () => sub.remove();
  }, [run, refetch]);
}
