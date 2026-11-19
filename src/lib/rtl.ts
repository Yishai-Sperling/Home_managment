import { I18nManager } from 'react-native';

// נקרא פעם אחת בטעינת האפליקציה. ב-Expo Go השינוי נכנס לתוקף אחרי טעינה מחדש.
export function ensureRTL() {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
}
