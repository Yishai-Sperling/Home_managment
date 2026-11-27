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

## התראות Push (מומלץ)
1. **מיגרציה:** ב-SQL Editor הרץ את `migrations/0006_push_tokens.sql`.
2. **הפונקציה:** ב-Dashboard ← Edge Functions ← Deploy a new function ← Via Editor, בשם `notify-house`; הדבק את התוכן של `functions/notify-house/index.ts`. **כבה** את Verify JWT (ה-Webhook מאומת בכותרת סודית).
3. **סוד:** ב-Edge Functions ← Secrets הוסף `WEBHOOK_SECRET` (מחרוזת אקראית ארוכה שאתה ממציא). מיילים אופציונליים: `RESEND_API_KEY` ו-`MAIL_FROM`. בלעדיהם נשלחות רק התראות Push.
4. **Webhooks:** ב-Database ← Webhooks צור ארבעה, אחד לכל טבלה (`shopping_items`, `car_reservations`, `announcements`, `issues`), אירוע Insert בלבד, סוג Supabase Edge Functions ← `notify-house`, עם הכותרת `x-webhook-secret` בערך של `WEBHOOK_SECRET`. (חלופה: `migrations/0005_webhooks.sql` אחרי החלפת הערכים.)
5. **אפליקציה:** נדרשת בנייה חדשה עם Firebase (FCM), ראה README הראשי.

## עדכון: שריון חוזר, העדפות התראות והגנת מנהל אחרון
1. **SQL Editor:** הריצו את `migrations/0007_features.sql` (ואז, אחרי שהצליח, את `migrations/0008_webhooks_v2.sql`). בלי שום עריכה — 0008 מעתיק את כתובת ה-Webhook והסוד מהטריגר הקיים `notify_house_webhook` שעל `shopping_items`. אם הוא לא קיים תודפס הודעה והשלב ידולג (אז צרו Webhook ידנית ל-`car_recurring_rules`, אירוע Insert). שניהם בטוחים להרצה חוזרת.
2. **הפונקציה:** ב-Dashboard ← Edge Functions ← `notify-house` ← Code, הדביקו את התוכן החדש של `functions/notify-house/index.ts` ופרסו מחדש (Verify JWT נשאר כבוי).
3. **מה חדש:** שריון חוזר (טבלת `car_recurring_rules`, כתיבה רק דרך RPC: `create_recurring_rule`, `update_recurring_rule`, `delete_recurring_rule`, `skip_occurrence`, `materialize_recurring`), העדפות התראה לפי סוג (`profiles.notify_prefs`), וחסימת הסרה/הורדת דרגה של המנהל האחרון בבית שיש בו חברים נוספים (שגיאה `last_admin`).
4. **בדיקות:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/features.sql` (אחרי 0001–0004, 0006, 0007; מסתיים ב-`ALL FEATURE TESTS PASSED`).

## עדכון: נוכחות דיירים, מידע על הבית, מועדפים בקניות והתראות על עדכון תקלה
1. **SQL Editor:** הריצו את `migrations/0010_family_features.sql` ואחריו (אחרי שהצליח) את `migrations/0011_webhooks_issues_update.sql`. בלי שום עריכה — 0011 מעתיק את כתובת ה-Webhook והסוד מהטריגר הקיים `notify_house_webhook` שעל `shopping_items` (כמו 0008) ויוצר טריגר `notify_house_webhook_update` על `issues`. אם הטריגר הקיים לא נמצא תודפס הודעה והשלב ידולג (אז צרו Webhook ידנית ל-`issues`, אירוע Update). שניהם בטוחים להרצה חוזרת.
2. **הפונקציה:** ב-Dashboard ← Edge Functions ← `notify-house` ← Code, הדביקו את התוכן החדש של `functions/notify-house/index.ts` ופרסו מחדש (Verify JWT נשאר כבוי).
3. **מה חדש:**
   - נוכחות: עמודות `presence` / `presence_eta` / `presence_updated_at` ב-`house_members`; עדכון רק דרך `set_presence(p_house uuid, p_status text, p_eta timestamptz default null)` (שגיאות: `not_authenticated`, `not_member`, `invalid_status`). סטטוס `null` מנקה; `soon` שומר שעת חזרה, כל סטטוס אחר מאפס אותה.
   - `house_info_items` (מידע על הבית): כל חבר קורא, מוסיף ומעדכן; מחיקה ליוצר או למנהל.
   - `shopping_favorites`: מועדפים לקניות, שם ייחודי בבית (ללא רגישות לאותיות), כל חבר יכול לנהל.
   - `issues.updated_by`: נקבע אוטומטית בטריגר, ומאפשר להתראה לדעת מי ביצע את העדכון.
   - התראות Push על תקלות (ללא מייל): תקלה שנסגרה או עברה ל"בטיפול" מתריעה ליוצר; הקצאה לאחראי חדש מתריעה לאחראי. הפועל עצמו לא מקבל התראה, וההעדפה `issues` נשמרת. אם היוצר הוא גם האחראי החדש נשלחת הודעה אחת (הקצאה, או "נסגרה" אם התקלה נסגרה באותו עדכון).
4. **בדיקות:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/family.sql` (אחרי 0001–0004, 0006, 0007, 0009, 0010; מסתיים ב-`ALL FAMILY TESTS PASSED`).

## עדכון: מיקום הבית
1. **SQL Editor:** הריצו את `migrations/0012_house_location.sql`. בלי שום עריכה, בטוח להרצה חוזרת.
2. **מה חדש:** עמודות `home_lat` / `home_lng` / `home_radius_m` (ברירת מחדל 150 מטר, טווח 50–1000) ב-`houses`. כל חבר בית קורא; עדכון רק למנהל, דרך `set_house_location(p_house uuid, p_lat double precision default null, p_lng double precision default null, p_radius_m integer default 150)` (שגיאות: `not_authenticated`, `not_member`, `forbidden`, `invalid_location`). שליחת `null` בשתי הקואורדינטות מנקה את המיקום.
3. **בדיקות:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/location.sql` (אחרי 0001–0004, 0006, 0007, 0009, 0010, 0012; מסתיים ב-`ALL LOCATION TESTS PASSED`).

## עדכון: התראות "הגיע/יצא מהבית"
1. **SQL Editor:** הריצו את `migrations/0013_presence_webhook.sql` (אחרי 0010 ו-0011). בלי שום עריכה, בטוח להרצה חוזרת: הוא מעתיק את כתובת ה-Webhook והסוד מהטריגר הקיים `notify_house_webhook` שעל `shopping_items` ויוצר טריגר `notify_house_webhook_presence` על `house_members` שנורה רק כשהעמודה `presence` משתנה. אם הטריגר הקיים לא נמצא תודפס הודעה והשלב ידולג.
2. **הפונקציה:** פרסו מחדש את `functions/notify-house/index.ts` (Edge Functions ← `notify-house` ← Code; Verify JWT נשאר כבוי).
3. **התנהגות:** Push בלבד לשאר חברי הבית ("דנה הגיעה הביתה" / "דנה יצאה מהבית"), רק למי שהפעיל `notify_prefs.presence_events = true` (ברירת מחדל: כבוי). לא נשלח אם הפועל כיבה `share_presence`. מעבר ל-`soon`/ניקוי מתעלמים, ושינוי בין home ל-away בפחות מ-5 דקות מהקודם נחסם (נגד הבהוב).
4. **בדיקות:** `tests/presence_webhook.sql` (דורש קודם את `tests/webhook_stub.sql` אחרי ה-shim ולפני 0005).
