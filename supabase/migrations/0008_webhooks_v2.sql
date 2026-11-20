-- 0008_webhooks_v2.sql — מריצים אחרי 0007. בלי עריכה: הטריגרים מועתקים מהטריגר הקיים
-- notify_house_webhook שעל public.shopping_items (כתובת, כותרות, סוד), ולכן אין כאן ref/סוד.
--  (i)  car_reservations: ההתראה רק לשריון ידני (WHEN recurring_rule_id IS NULL) — מופעים שנוצרו מסדרה לא מציפים.
--  (ii) car_recurring_rules: התראה אחת ביצירת סדרה.
-- אם הטריגר/הסכמה חסרים — מודפסת הודעה ודילוג (צרו את ה-Webhook בדשבורד לפי README).

do $$
declare
  v_fn   regproc;
  v_args text[];
  v_raw  text;
  v_list text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'supabase_functions') then
    raise notice 'supabase_functions schema not found; skipping (create webhooks from the dashboard).';
    return;
  end if;

  select t.tgfoid::regproc, encode(t.tgargs, 'escape')
    into v_fn, v_raw
  from pg_trigger t
  where t.tgrelid = 'public.shopping_items'::regclass
    and t.tgname = 'notify_house_webhook' and not t.tgisinternal;

  if v_fn is null then
    raise notice 'notify_house_webhook not found on public.shopping_items; skipping.';
    return;
  end if;

  -- tgargs: מחרוזות מופרדות ב-NUL (מוצג כ-\000 בקידוד escape), עם NUL בסוף
  v_raw := regexp_replace(v_raw, '\\000$', '');
  v_args := string_to_array(v_raw, '\000');
  v_args := array(select replace(x, '\\', '\') from unnest(v_args) x);
  select string_agg(quote_literal(x), ', ') into v_list from unnest(v_args) x;

  execute 'drop trigger if exists notify_house_webhook on public.car_reservations';
  execute format(
    'create trigger notify_house_webhook after insert on public.car_reservations
       for each row when (new.recurring_rule_id is null)
       execute function %s(%s)', v_fn, v_list);

  if to_regclass('public.car_recurring_rules') is null then
    raise notice 'car_recurring_rules missing (run 0007 first); skipping its trigger.';
    return;
  end if;
  execute 'drop trigger if exists notify_house_webhook on public.car_recurring_rules';
  execute format(
    'create trigger notify_house_webhook after insert on public.car_recurring_rules
       for each row execute function %s(%s)', v_fn, v_list);
end $$;
