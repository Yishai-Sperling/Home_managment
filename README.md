# ניהול הבית

אפליקציית React Native (Expo) בעברית ו-RTL לניהול בית משותף: קניות, שריון רכב, מודעות ותקלות, בזמן אמת, עם Supabase.

## הקמה
1. צור פרויקט ב-[Supabase](https://supabase.com) והרץ את הקבצים ב-`supabase/migrations/` לפי הסדר (פירוט ב-`supabase/README.md`).
2. העתק `.env.example` ל-`.env` ומלא את `EXPO_PUBLIC_SUPABASE_URL` ו-`EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. למיילים: חשבון Resend, וכן הפעלת `notify-house` והגדרת ה-webhooks (ראה `supabase/README.md`).
4. הרצה:
```bash
npm install
npx expo start
```
סרוק את ה-QR עם Expo Go באנדרואיד או ב-iPhone.

## בדיקות
```bash
npm run typecheck && npm run lint && npm test
```

## הרצה מהירה ב-Windows
לחיצה כפולה על `run.bat`: מעדכן מ-GitHub, מתקין חבילות אם צריך ומפעיל את Expo.

## הפצה למכשירים נוספים (אנדרואיד)
בונים קובץ APK בענן של Expo, ושולחים לכל אחד קישור להתקנה. פעם אחת:
```bash
npx eas-cli login
```
```bash
npx eas-cli init
```
משתני הסביבה (קובץ `.env` לא עולה ל-GitHub, ולכן מגדירים אותם גם ב-EAS):
```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --environment preview --visibility plaintext
```
```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --environment preview --visibility plaintext
```
בנייה:
```bash
npx eas-cli build -p android --profile preview
```
בסיום מתקבל קישור להורדה. בטלפון מאשרים "התקנה ממקורות לא ידועים".

## עדכונים בלי התקנה מחדש (EAS Update)
חד-פעמי: `npx eas-cli update:configure` (מקשר את הפרויקט ומוסיף `updates.url` ל-`app.json`), ואז בנייה חדשה והתקנה של ה-APK:
```bash
npx eas-cli build -p android --profile preview
```
אחרי כל שינוי בקוד (שאינו חבילה נייטיבית חדשה), שולחים עדכון לכל המכשירים:
```bash
npx eas-cli update --channel preview --message "תיאור השינוי"
```
האפליקציה מורידה את העדכון בפתיחה, ומחילה אותו בפתיחה הבאה. הוספת חבילה נייטיבית או שינוי ב-`app.json` דורשים בנייה חדשה.
