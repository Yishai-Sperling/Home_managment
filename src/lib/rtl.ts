import { DevSettings, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FLAG = 'rtl-reloaded-v1';

/**
 * מפעיל RTL. בשינוי הראשון הוא נכנס לתוקף רק אחרי טעינה מחדש של האפליקציה (Expo Go / dev),
 * לכן מבצעים reload אחד, עם דגל כדי לא להיכנס ללולאה.
 */
export function ensureRTL() {
  if (I18nManager.isRTL) return;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  AsyncStorage.getItem(FLAG)
    .then(async (done) => {
      if (done) return;
      await AsyncStorage.setItem(FLAG, '1');
      DevSettings.reload();
    })
    .catch(() => {});
}
