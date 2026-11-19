# Supabase — הקמת הבק-אנד

## 1. יצירת פרויקט
1. היכנסו ל-https://supabase.com/dashboard ולחצו **New project**.
2. שמרו את **Project URL** ואת **anon key** (Settings > API) — הם נכנסים ל-`.env` של האפליקציה
   (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). את ה-service role key לא שמים באפליקציה.
3. ב-**Authentication > Providers** ודאו ש-Email מופעל. בסביבת פיתוח אפשר לכבות "Confirm email".

## 2. הרצת המיגרציות
לפי הסדר, ב-**SQL Editor** (הדביקו והריצו כל קובץ), או עם ה-CLI:

```bash
npm i -g supabase            # או: npx supabase
supabase login
supabase link --project-ref <PROJECT_REF>
```

קבצים:
1. `migrations/0001_schema.sql` — טבלאות, אילוצים, טריגר פרופיל
2. `migrations/0002_rls.sql` — מדיניות RLS
3. `migrations/0003_rpc.sql` — `create_house`, `join_house`, Realtime
4. `migrations/0004_storage.sql` — דלי `issue-images` (פרטי)
5. `migrations/0005_webhooks.sql` — **אל תריצו לפני שלב 4** (צריך להחליף שם פרויקט וסוד)

עם ה-CLI: `supabase db push` (אחרי עריכת 0005, ראו שלב 4).

## 3. Secrets ופריסת הפונקציה
צרו חשבון ב-https://resend.com, אמתו דומיין שולח וצרו API key.

```bash
supabase secrets set RESEND_API_KEY=re_xxx \
  MAIL_FROM="הבית <noreply@your-domain.com>" \
  WEBHOOK_SECRET="$(openssl rand -hex 32)"
supabase functions deploy notify-house --no-verify-jwt
```

שמרו את ערך `WEBHOOK_SECRET` — תצטרכו אותו בשלב הבא. (`--no-verify-jwt` מוגדר גם ב-`config.toml`;
הפונקציה מאמתת את הכותרת `x-webhook-secret` בעצמה.)

## 4. יצירת ה-Webhooks
**אפשרות א׳ (SQL):** ערכו את `migrations/0005_webhooks.sql` — החליפו `YOUR_PROJECT_REF` ו-`CHANGE_ME_WEBHOOK_SECRET`
(אותו ערך כמו ב-secret) — והריצו. נוצר טריגר INSERT על ארבע הטבלאות. אל תעשו commit לסוד האמיתי.

**אפשרות ב׳ (דשבורד):** **Database > Webhooks > Create**, עבור כל אחת מהטבלאות
`shopping_items`, `car_reservations`, `announcements`, `issues`:
- Events: **Insert** בלבד
- Type: **Supabase Edge Functions** → `notify-house`, Method `POST`
- HTTP Headers: הוסיפו `x-webhook-secret` עם ערך הסוד.

(בחרו אפשרות אחת בלבד, אחרת יישלחו מיילים כפולים.)

## 5. בדיקות
מול בסיס נתונים שהמיגרציות 0001–0004 הורצו עליו (מומלץ מקומי: `supabase start`):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```
הבדיקות רצות בטרנזקציה ומסתיימות ב-ROLLBACK. ההודעה `ALL RLS TESTS PASSED` מסמנת הצלחה.
(`tests/supabase_shim.sql` מדמה סכמות Supabase עבור Postgres רגיל בלבד — לא להריץ בפרויקט אמיתי.)

## הערות
- קודי שגיאה מה-RPC: `not_authenticated`, `invalid_name`, `invalid_code` — האפליקציה ממפה אותם להודעות בעברית.
- יצירת בית והצטרפות מתבצעות רק דרך `create_house` / `join_house`; אין הרשאת INSERT ישירה על `houses` / `house_members`.
- נתיב תמונת תקלה: `<house_id>/<uuid>.jpg` (דלי `issue-images`, גישה דרך signed URL).
- ברשימת הקניות כל חבר בית יכול לעדכן פריט (סימון "נקנה"); בשאר הטבלאות רק היוצר או המנהל (בתקלות גם האחראי המשויך).
- אם המנהל האחרון עוזב, הבית נשאר בלי מנהל — מומלץ להעביר ניהול לפני עזיבה.
