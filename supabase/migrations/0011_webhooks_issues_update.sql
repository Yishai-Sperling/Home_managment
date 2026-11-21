-- 0011_webhooks_issues_update.sql — מריצים אחרי 0010 (ואחרי 0005/0008). בלי עריכה.
-- טריגר AFTER UPDATE על public.issues שקורא ל-notify-house כשהסטטוס או האחראי השתנו.
-- כתובת/כותרות/סוד מועתקים מהטריגר הקיים notify_house_webhook שעל shopping_items (כמו ב-0008).
-- אם הטריגר/הסכמה חסרים — מודפסת הודעה ודילוג. בטוח להרצה חוזרת.

do $$
declare
  v_fn   regproc;
  v_args text[];
  v_raw  text;
  v_list text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'supabase_functions') then
    raise notice 'supabase_functions schema not found; skipping (create the UPDATE webhook from the dashboard).';
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

  v_raw := regexp_replace(v_raw, '\\000$', '');
  v_args := string_to_array(v_raw, '\000');
  v_args := array(select replace(x, '\\', '\') from unnest(v_args) x);
  select string_agg(quote_literal(x), ', ') into v_list from unnest(v_args) x;

  execute 'drop trigger if exists notify_house_webhook_update on public.issues';
  execute format(
    'create trigger notify_house_webhook_update after update on public.issues
       for each row
       when (old.status is distinct from new.status or old.assignee_id is distinct from new.assignee_id)
       execute function %s(%s)', v_fn, v_list);
end $$;
