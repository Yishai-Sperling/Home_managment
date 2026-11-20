import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { supabase } from '@/lib/supabase';

let lastToken: string | null = null;

/** Expo Go (ב-SDK 53 ומעלה) לא תומך ב-push מרוחק, וגם סימולטור. מדלגים בשקט. */
function supported() {
  return Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** מבקש הרשאה, מקבל Expo Push Token ושומר אותו ב-Supabase. לא זורק שגיאות. */
export async function registerForPush(userId: string): Promise<void> {
  try {
    if (!supported()) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'התראות הבית',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    lastToken = token;
    await supabase.from('push_tokens').upsert(
      { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
  } catch {
    // התראות הן תוספת: כשל כאן לא צריך להפריע לשימוש באפליקציה
  }
}

/** נקרא לפני התנתקות, כדי שהמכשיר לא ימשיך לקבל התראות של המשתמש הקודם. */
export async function unregisterPush(): Promise<void> {
  try {
    if (lastToken) await supabase.from('push_tokens').delete().eq('token', lastToken);
    lastToken = null;
  } catch {
    // לא קריטי
  }
}

