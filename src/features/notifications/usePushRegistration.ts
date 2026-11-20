import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSession } from '@/lib/session';
import { configureNotificationHandler, registerForPush } from './registerPush';
import { routeForNotification } from './route';

configureNotificationHandler();

/** רושם את המכשיר להתראות כשיש משתמש מחובר, ופותח את המסך הנכון בלחיצה על התראה. */
export function usePushRegistration(enabled: boolean) {
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (enabled && userId) registerForPush(userId);
  }, [enabled, userId]);

  useEffect(() => {
    const open = (data: unknown) => {
      const route = routeForNotification(data);
      if (route) router.push(route as never);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    // אפליקציה שנפתחה מלחיצה על התראה כשהייתה סגורה
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    return () => sub.remove();
  }, []);
}
