import type { ExpoConfig } from 'expo/config';

/**
 * עוטף את app.json. google-services.json (נדרש ל-FCM באנדרואיד) לא עולה ל-GitHub:
 * הוא מועלה ל-EAS כמשתנה סביבה מסוג קובץ בשם GOOGLE_SERVICES_JSON.
 * בלי המשתנה (למשל בפיתוח ב-Expo Go) ההגדרה פשוט מדולגת.
 */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
