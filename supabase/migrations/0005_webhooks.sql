-- 0005_webhooks.sql — Database Webhooks שקוראים ל-Edge Function `notify-house` בכל INSERT.
--
-- !! לפני ההרצה: החליפו את v_project_ref ואת v_secret למטה !!
--   v_project_ref = מזהה הפרויקט (Settings > General > Reference ID)
--   v_secret      = אותו ערך בדיוק שהוגדר כ-secret בשם WEBHOOK_SECRET של הפונקציה
-- (אפשר גם ליצור את ה-Webhooks ידנית בדשבורד: Database > Webhooks, ראו README.)
--
-- הטריגר משתמש ב-supabase_functions.http_request (נשען על pg_net) ושולח את מטען ה-Webhook
-- הסטנדרטי {type, table, record, schema, old_record} עם הכותרת x-webhook-secret.
-- רק INSERT; עדכונים ומחיקות לא מפעילים התראות.

do $$
declare
  v_project_ref constant text := 'YOUR_PROJECT_REF';
  v_secret      constant text := 'CHANGE_ME_WEBHOOK_SECRET';
  v_url         text := 'https://' || v_project_ref || '.supabase.co/functions/v1/notify-house';
  v_headers     text := json_build_object(
                          'Content-Type', 'application/json',
                          'x-webhook-secret', v_secret)::text;
  t text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'supabase_functions') then
    raise notice 'supabase_functions schema not found; create the webhooks from the dashboard instead.';
    return;
  end if;

  foreach t in array array['shopping_items', 'car_reservations', 'announcements', 'issues']
  loop
    execute format('drop trigger if exists notify_house_webhook on public.%I', t);
    execute format(
      'create trigger notify_house_webhook after insert on public.%I
         for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      t, v_url, 'POST', v_headers, '{}', '5000');
  end loop;
end $$;
