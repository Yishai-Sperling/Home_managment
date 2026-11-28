-- בדיקות ל-0014_presence_auto.sql. סדר הרצה: supabase_shim.sql, webhook_stub.sql, 0001-0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014. הרצה:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/presence_auto.sql
-- "ALL PRESENCE AUTO TESTS PASSED" = הצלחה. רץ בטרנזקציה ונגמר ב-ROLLBACK.
begin;

-- רק חתימה אחת, ללא הפונקציה הישנה
do $$ begin
  assert (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='set_presence') = 1, 'single set_presence';
  assert to_regprocedure('public.set_presence(uuid,text,timestamptz)') is null, 'old 3-arg gone';
  assert to_regprocedure('public.set_presence(uuid,text,timestamptz,boolean)') is not null, 'new 4-arg exists';
  assert not has_function_privilege('anon', 'public.set_presence(uuid,text,timestamptz,boolean)', 'execute'), 'anon no exec';
  assert has_function_privilege('authenticated', 'public.set_presence(uuid,text,timestamptz,boolean)', 'execute'), 'auth exec';
  assert has_function_privilege('service_role', 'public.set_presence(uuid,text,timestamptz,boolean)', 'execute'), 'service exec';
end $$;

-- הרצה חוזרת של המיגרציה
\i supabase/migrations/0014_presence_auto.sql
do $$ begin
  assert (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='set_presence') = 1, 'idempotent';
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'b@example.com', '{"full_name":"B"}'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'c@example.com', '{"full_name":"C"}');
insert into public.houses (id, name, join_code, admin_email, created_by) values
  ('ffffffff-0000-0000-0000-000000000001', 'בית', 'AUTO01', 'a@example.com', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.house_members (house_id, user_id, role) values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'admin'),
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 'member');

do $$ begin
  assert (select presence_auto from public.house_members where user_id='eeeeeeee-0000-0000-0000-000000000002') = false, 'default false';
end $$;
truncate supabase_functions.calls;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  h uuid := 'ffffffff-0000-0000-0000-000000000001';
  me uuid := 'eeeeeeee-0000-0000-0000-000000000002';
  eta timestamptz := now() + interval '1 hour';
  r record; msg text;
begin
  perform public.set_presence(h, 'home', null, true);
  select * into r from public.house_members where house_id=h and user_id=me;
  assert r.presence='home' and r.presence_auto = true, 'auto stored';
  assert r.role = 'member', 'role untouched';

  -- p_auto מושמט מאפס
  perform public.set_presence(h, 'away');
  assert (select presence_auto from public.house_members where house_id=h and user_id=me) = false, 'omitted -> false';
  assert (select presence from public.house_members where house_id=h and user_id=me) = 'away', 'away set';

  perform public.set_presence(h, 'home', null, true);
  perform public.set_presence(h, 'soon', eta);
  select * into r from public.house_members where house_id=h and user_id=me;
  assert r.presence='soon' and r.presence_eta = eta and r.presence_auto = false, 'soon keeps eta, auto false';

  -- ארגומנטים בשם (בסגנון PostgREST)
  perform public.set_presence(p_house => h, p_status => 'home');
  assert (select presence_auto from public.house_members where house_id=h and user_id=me) = false, 'named omitted';
  perform public.set_presence(p_house => h, p_status => 'away', p_auto => true);
  assert (select presence_auto from public.house_members where house_id=h and user_id=me) = true, 'named auto';
  perform public.set_presence(p_house => h, p_status => 'home', p_eta => eta, p_auto => true);
  select * into r from public.house_members where house_id=h and user_id=me;
  assert r.presence_eta is null and r.presence_auto = true, 'home drops eta, keeps auto';

  -- p_auto null נחשב false
  perform public.set_presence(h, 'home', null, null);
  assert (select presence_auto from public.house_members where house_id=h and user_id=me) = false, 'null auto -> false';

  -- סטטוס null מאפס הכל כולל auto
  perform public.set_presence(h, 'away', null, true);
  perform public.set_presence(h, null, null, true);
  select * into r from public.house_members where house_id=h and user_id=me;
  assert r.presence is null and r.presence_eta is null and r.presence_updated_at is null and r.presence_auto = false, 'null clears auto';

  begin perform public.set_presence(h, 'sleeping', null, true); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'invalid_status', 'invalid_status got ' || msg; end;

  assert (select count(*) from public.house_members where house_id=h and presence_auto) = 0, 'no auto left';
  assert (select presence from public.house_members where user_id='eeeeeeee-0000-0000-0000-000000000001') is null, 'other untouched';
end $$;

-- זר: not_member; לא מזוהה: not_authenticated
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ declare msg text; begin
  begin perform public.set_presence('ffffffff-0000-0000-0000-000000000001', 'home', null, true); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'not_member', 'outsider got ' || msg; end;
end $$;
select set_config('request.jwt.claims', '', true);
do $$ declare msg text; begin
  begin perform public.set_presence('ffffffff-0000-0000-0000-000000000001', 'home', null, true); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'not_authenticated', 'anon got ' || msg; end;
end $$;
reset role;

-- הטריגר של ה-webhook עדיין פועל; שינוי auto בלבד לא מפעיל
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl='house_members' and op='UPDATE') > 0, 'webhook fired via RPC';
end $$;
truncate supabase_functions.calls;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.set_presence('ffffffff-0000-0000-0000-000000000001', 'home', null, true);
select public.set_presence('ffffffff-0000-0000-0000-000000000001', 'home', null, false);
reset role;
do $$ begin
  assert (select count(*) from supabase_functions.calls where tbl='house_members') = 1, 'only presence change fires';
  assert exists (select 1 from supabase_functions.calls where tbl='house_members' and old_presence is null and new_presence='home'), 'null->home';
  assert exists (select 1 from pg_trigger where tgrelid='public.house_members'::regclass and tgname='notify_house_webhook_presence'), 'trigger intact';
end $$;

select 'ALL PRESENCE AUTO TESTS PASSED' as result;
rollback;
