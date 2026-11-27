-- בדיקות ל-0013_presence_webhook.sql. סדר הרצה: supabase_shim.sql, webhook_stub.sql, 0001-0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013. הרצה:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/presence_webhook.sql
-- "ALL PRESENCE WEBHOOK TESTS PASSED" = הצלחה. רץ בטרנזקציה ונגמר ב-ROLLBACK.
begin;

do $$
declare def text; src text[]; dst text[];
begin
  select pg_get_triggerdef(oid) into def from pg_trigger
   where tgrelid = 'public.house_members'::regclass and tgname = 'notify_house_webhook_presence';
  assert def is not null, 'trigger exists';
  assert def ilike '%after update%' and def ilike '%for each row%', 'after update row: ' || def;
  assert def like '%old.presence IS DISTINCT FROM new.presence%', 'when clause: ' || def;
  select string_to_array(encode(tgargs,'escape'),'\000') into src from pg_trigger
   where tgrelid = 'public.shopping_items'::regclass and tgname = 'notify_house_webhook';
  select string_to_array(encode(tgargs,'escape'),'\000') into dst from pg_trigger
   where tgrelid = 'public.house_members'::regclass and tgname = 'notify_house_webhook_presence';
  assert src = dst, 'args copied exactly';
  assert array_length(dst,1) >= 3, 'has args';
end $$;

-- הרצה חוזרת: עדיין טריגר אחד בלבד
\i supabase/migrations/0013_presence_webhook.sql
do $$ begin
  assert (select count(*) from pg_trigger where tgrelid='public.house_members'::regclass
          and tgname='notify_house_webhook_presence') = 1, 'idempotent';
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'b@example.com', '{"full_name":"B"}');
insert into public.houses (id, name, join_code, admin_email, created_by) values
  ('dddddddd-0000-0000-0000-000000000001', 'בית', 'PRES01', 'a@example.com', 'cccccccc-0000-0000-0000-000000000001');
insert into public.house_members (house_id, user_id, role) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'admin'),
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'member');

truncate supabase_functions.calls;

-- הוספת חבר ושינוי תפקיד: לא מפעילים
update public.house_members set role = 'admin' where user_id = 'cccccccc-0000-0000-0000-000000000002';
update public.house_members set role = 'member' where user_id = 'cccccccc-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl = 'house_members') = 0, 'role change does not fire';
end $$;

-- presence שמשתנה: מפעיל
update public.house_members set presence = 'home', presence_updated_at = now()
 where user_id = 'cccccccc-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl='house_members' and op='UPDATE'
          and new_presence='home' and old_presence is null) = 1, 'null->home fires once';
end $$;

-- שינוי eta / updated_at בלבד: לא מפעיל
update public.house_members set presence_eta = now(), presence_updated_at = now() + interval '1 minute'
 where user_id = 'cccccccc-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl='house_members') = 1, 'eta/updated_at only does not fire';
end $$;

update public.house_members set presence = 'away' where user_id = 'cccccccc-0000-0000-0000-000000000002';
update public.house_members set presence = null where user_id = 'cccccccc-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl='house_members') = 3, 'home->away and away->null fire';
  assert (select count(*) from supabase_functions.calls where tbl='house_members' and old_presence='home' and new_presence='away') = 1, 'home->away recorded';
end $$;

-- טריגרי ה-webhook הקיימים לא הושפעו
do $$ begin
  assert exists (select 1 from pg_trigger where tgrelid='public.issues'::regclass and tgname='notify_house_webhook_update'), 'issues update trigger intact';
end $$;

select 'ALL PRESENCE WEBHOOK TESTS PASSED' as result;
rollback;
