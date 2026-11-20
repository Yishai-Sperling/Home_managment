import * as Notifications from 'expo-notifications';
import { routeForNotification } from '@/features/notifications/route';

/**
 * ב-Android לחיצה על התראה פותחת את האפליקציה עם כתובת פנימית של expo-notifications
 * (expo-notifications://notifications/<id>) שאינה מסך באפליקציה, והנתב נתקע עליה.
 * כאן ממירים אותה למסך המתאים (לפי data.screen של ההתראה), או למסך הבית.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes('expo-notifications')) {
      const data = Notifications.getLastNotificationResponse()?.notification.request.content.data;
      return routeForNotification(data) ?? '/';
    }
  } catch {
    return '/';
  }
  return path;
}
