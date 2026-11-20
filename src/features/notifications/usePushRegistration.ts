import { useEffect, useRef } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSession } from '@/lib/session';
import { configureNotificationHandler, registerForPush } from './registerPush';
import { routeForNotification } from './route';

configureNotificationHandler();

/**
 * רושם את המכשיר להתראות כשיש משתמש מחובר, ופותח את המסך הנכון בלחיצה על התראה.
 * הניווט מתבצע רק אחרי שהנווט (Stack) נטען ויש בית פעיל: ניווט מוקדם מדי (בזמן ספינר הטעינה)
 * גורם לתקיעה כשהאפליקציה נפתחת מלחיצה על התראה כשהייתה סגורה.
 */
export function usePushRegistration(enabled: boolean) {
  const { session } = useSession();
  const userId = session?.user.id;
  const navReady = !!useRootNavigationState()?.key;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (enabled && userId) registerForPush(userId);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !navReady || !lastResponse) return;
    const id = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}`;
    if (handled.current === id) return;
    const route = routeForNotification(lastResponse.notification.request.content.data);
    if (!route) {
      handled.current = id;
      return;
    }
    // השהיה קצרה כדי שהמסכים הראשוניים יסיימו להיטען לפני הניווט
    const t = setTimeout(() => {
      handled.current = id;
      try {
        // +native-intent כבר ניווט למסך הזה בדרך כלל; לא מוסיפים עותק נוסף למחסנית
        if (pathRef.current !== route) router.push(route as never);
      } catch {
        // אם הניווט נכשל, האפליקציה פשוט נשארת במסך הבית
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, navReady, lastResponse]);
}
