# ניהול הבית

אפליקציית React Native (Expo) בעברית ו-RTL לניהול בית משותף: קניות, שריון רכב, מודעות ותקלות, בזמן אמת, עם Supabase.

## הקמה
1. צור פרויקט ב-[Supabase](https://supabase.com) והרץ את הקבצים ב-`supabase/migrations/` לפי הסדר (פירוט ב-`supabase/README.md`).
2. העתק `.env.example` ל-`.env` ומלא את `EXPO_PUBLIC_SUPABASE_URL` ו-`EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. למיילים: חשבון Resend, וכן הפעלת `notify-house` והגדרת ה-webhooks (ראה `supabase/README.md`).
4. הרצה:
```bash
npm install --legacy-peer-deps
npx expo start
```
סרוק את ה-QR עם Expo Go באנדרואיד או ב-iPhone.

## בדיקות
```bash
npm run typecheck && npm run lint && npm test
```
