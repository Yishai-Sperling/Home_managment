-- בדיקות ל-0010_family_features.sql (אחרי 0001-0004,0006,0007,0009,0010). הרצה:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/family.sql
-- רץ בטרנזקציה ונגמר ב-ROLLBACK. דורש superuser. "ALL FAMILY TESTS PASSED" = הצלחה.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'b@example.com', '{"full_name":"B"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'c@example.com', '{"full_name":"C"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'd@example.com', '{"full_name":"D"}');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- A מנהל בית 1; B ו-D חברים; C מנהל בית 2 (זר)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into ctx select 'h1', (select id::text from public.create_house('בית 1'));
insert into ctx select 'code1', (select join_code from public.houses where id = (select v::uuid from ctx where k='h1'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into ctx select 'h2', (select id::text from public.create_house('בית 2'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.join_house((select v from ctx where k='code1'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
select public.join_house((select v from ctx where k='code1'));

-- ───────── set_presence ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  eta timestamptz := now() + interval '1 hour';
  r record; n int; msg text;
begin
  select presence, presence_eta, presence_updated_at into r
    from public.house_members where house_id = h and user_id = auth.uid();
  assert r.presence is null and r.presence_eta is null and r.presence_updated_at is null, 'presence starts null';

  perform public.set_presence(h, 'soon', eta);
  select * into r from public.house_members where house_id = h and user_id = auth.uid();
  assert r.presence = 'soon' and r.presence_eta = eta and r.presence_updated_at is not null, 'soon keeps eta';
  assert r.role = 'member', 'role unchanged';

  perform public.set_presence(h, 'soon');
  assert (select presence_eta from public.house_members where house_id = h and user_id = auth.uid()) is null,
         'soon with null eta allowed';

  perform public.set_presence(h, 'soon', eta);
  perform public.set_presence(h, 'home', eta);
  select * into r from public.house_members where house_id = h and user_id = auth.uid();
  assert r.presence = 'home' and r.presence_eta is null, 'home drops eta';

  perform public.set_presence(h, 'away', eta);
  assert (select presence_eta from public.house_members where house_id = h and user_id = auth.uid()) is null,
         'away drops eta';

  assert (select count(*) from public.house_members where house_id = h and presence is not null) = 1,
         'only caller row changed';

  perform public.set_presence(h, null);
  select * into r from public.house_members where house_id = h and user_id = auth.uid();
  assert r.presence is null and r.presence_eta is null and r.presence_updated_at is null, 'clear works';

  begin perform public.set_presence(h, 'sleeping'); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'invalid_status', 'invalid_status got ' || msg; end;

  -- עדכון ישיר: חבר רגיל לא יכול לעדכן נוכחות של אחר, גם לא של עצמו, ולא את התפקיד
  update public.house_members set presence = 'away'
   where house_id = h and user_id = 'aaaaaaaa-0000-0000-0000-000000000004'; get diagnostics n = row_count;
  assert n = 0, 'member cannot directly update another member';
  update public.house_members set presence = 'away'
   where house_id = h and user_id = auth.uid(); get diagnostics n = row_count;
  assert n = 0, 'no self-update policy (direct)';
  update public.house_members set role = 'admin'
   where house_id = h and user_id = auth.uid(); get diagnostics n = row_count;
  assert n = 0, 'cannot self-promote';
end $$;

-- זר: not_member
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare msg text;
begin
  begin perform public.set_presence((select v::uuid from ctx where k='h1'), 'home'); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'not_member', 'outsider got ' || msg; end;
end $$;

-- ללא התחברות: not_authenticated; anon: אין הרשאת הרצה
select set_config('request.jwt.claims', '', true);
do $$
declare msg text;
begin
  begin perform public.set_presence((select v::uuid from ctx where k='h1'), 'home'); assert false, 'should fail';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'not_authenticated', 'unauth got ' || msg; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.set_presence('aaaaaaaa-0000-0000-0000-0000000000ff', 'home'); assert false, 'anon should fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.house_members where presence is not null) = 0, 'outsider/anon changed nothing';
end $$;

-- ה-guard של מנהל אחרון לא מושפע מעדכון נוכחות; ועדיין חוסם שינוי role
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); msg text;
begin
  perform public.set_presence(h, 'home');
  assert (select presence from public.house_members where house_id = h and user_id = auth.uid()) = 'home';
  begin
    update public.house_members set role = 'member' where house_id = h and user_id = auth.uid();
    assert false, 'last admin guard';
  exception when others then get stacked diagnostics msg = message_text;
    assert msg = 'last_admin', 'got ' || msg; end;
end $$;

-- ───────── house_info_items ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  id1 uuid;
begin
  insert into public.house_info_items (house_id, label, value) values (h, 'וויי-פיי', 'pass123')
    returning id into id1;
  insert into ctx values ('info1', id1::text);
  assert (select created_by from public.house_info_items where id = id1) = auth.uid(), 'created_by default';
  assert (select kind from public.house_info_items where id = id1) = 'text' and
         not (select is_secret from public.house_info_items where id = id1), 'defaults';

  begin insert into public.house_info_items (house_id, label, value, created_by)
        values (h, 'x', 'y', 'aaaaaaaa-0000-0000-0000-000000000001'); assert false, 'forced';
  exception when insufficient_privilege then null; end;
  begin insert into public.house_info_items (house_id, label, value) values (h, '', 'y'); assert false;
  exception when check_violation then null; end;
  begin insert into public.house_info_items (house_id, label, value) values (h, repeat('x', 81), 'y'); assert false;
  exception when check_violation then null; end;
  begin insert into public.house_info_items (house_id, label, value) values (h, 'x', repeat('y', 501)); assert false;
  exception when check_violation then null; end;
  begin insert into public.house_info_items (house_id, label, value, kind) values (h, 'x', 'y', 'bogus'); assert false;
  exception when check_violation then null; end;
  insert into public.house_info_items (house_id, label, value, kind, is_secret)
    values (h, 'קוד', '1234', 'code', true);
  insert into public.house_info_items (house_id, label, value) values (h, repeat('x', 80), repeat('y', 500));
end $$;

-- D (חבר אחר) מעדכן פריט של B: מותר, created_by לא משתנה, updated_at מתקדם
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
declare
  id1 uuid := (select v::uuid from ctx where k='info1');
  before_ts timestamptz; n int;
begin
  select updated_at into before_ts from public.house_info_items where id = id1;
  perform pg_sleep(0.01);
  update public.house_info_items set value = 'newpass', created_by = auth.uid() where id = id1;
  get diagnostics n = row_count;
  assert n = 1, 'any member updates';
  assert (select value from public.house_info_items where id = id1) = 'newpass';
  assert (select created_by from public.house_info_items where id = id1) = 'aaaaaaaa-0000-0000-0000-000000000002',
         'created_by immutable';
  assert (select updated_at from public.house_info_items where id = id1) > before_ts, 'updated_at maintained';
  delete from public.house_info_items where id = id1; get diagnostics n = row_count;
  assert n = 0, 'non-creator non-admin cannot delete';
end $$;

-- זר: לא רואה, לא מוסיף, לא מעדכן, לא מוחק
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  id1 uuid := (select v::uuid from ctx where k='info1'); n int;
begin
  assert (select count(*) from public.house_info_items) = 0, 'outsider sees nothing';
  begin insert into public.house_info_items (house_id, label, value) values (h, 'x', 'y'); assert false;
  exception when insufficient_privilege then null; end;
  update public.house_info_items set value = 'hack' where id = id1; get diagnostics n = row_count;
  assert n = 0, 'outsider update';
  delete from public.house_info_items where id = id1; get diagnostics n = row_count;
  assert n = 0, 'outsider delete';
end $$;

-- A (מנהל) מוחק פריט של B; B מוחק את שלו
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare n int;
begin
  delete from public.house_info_items where label = 'קוד'; get diagnostics n = row_count;
  assert n = 1, 'admin deletes any';
end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare n int;
begin
  delete from public.house_info_items where id = (select v::uuid from ctx where k='info1'); get diagnostics n = row_count;
  assert n = 1, 'creator deletes own';
end $$;

-- anon: אין גישה
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.house_info_items; assert false; exception when insufficient_privilege then null; end;
  begin perform 1 from public.shopping_favorites; assert false; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ───────── shopping_favorites ─────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1'); fid uuid;
begin
  insert into public.shopping_favorites (house_id, name, quantity) values (h, 'Milk', '2') returning id into fid;
  insert into ctx values ('fav1', fid::text);
  assert (select category from public.shopping_favorites where id = fid) = 'other', 'default category';
  assert (select created_by from public.shopping_favorites where id = fid) = auth.uid(), 'created_by default';
  begin insert into public.shopping_favorites (house_id, name) values (h, 'mILK'); assert false;
  exception when unique_violation then null; end;
  begin insert into public.shopping_favorites (house_id, name) values (h, ''); assert false;
  exception when check_violation then null; end;
  begin insert into public.shopping_favorites (house_id, name) values (h, repeat('x', 81)); assert false;
  exception when check_violation then null; end;
  begin insert into public.shopping_favorites (house_id, name, category) values (h, 'z', 'bogus'); assert false;
  exception when check_violation then null; end;
  begin insert into public.shopping_favorites (house_id, name, created_by)
        values (h, 'forged', 'aaaaaaaa-0000-0000-0000-000000000001'); assert false;
  exception when insufficient_privilege then null; end;
  insert into public.shopping_favorites (house_id, name) values (h, 'לחם');
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
declare fid uuid := (select v::uuid from ctx where k='fav1'); n int;
begin
  assert (select count(*) from public.shopping_favorites) = 2, 'members see';
  update public.shopping_favorites set quantity = '5' where id = fid; get diagnostics n = row_count;
  assert n = 1, 'member updates';
  delete from public.shopping_favorites where id = fid; get diagnostics n = row_count;
  assert n = 1, 'member deletes';
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare h1 uuid := (select v::uuid from ctx where k='h1'); h2 uuid := (select v::uuid from ctx where k='h2'); n int;
begin
  assert (select count(*) from public.shopping_favorites) = 0, 'outsider sees nothing';
  begin insert into public.shopping_favorites (house_id, name) values (h1, 'x'); assert false;
  exception when insufficient_privilege then null; end;
  insert into public.shopping_favorites (house_id, name) values (h2, 'לחם');  -- אותו שם בבית אחר: מותר
  update public.shopping_favorites set name = 'x' where house_id = h1; get diagnostics n = row_count;
  assert n = 0, 'outsider update';
  delete from public.shopping_favorites where house_id = h1; get diagnostics n = row_count;
  assert n = 0, 'outsider delete';
end $$;

-- ───────── issues.updated_by ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); iid uuid;
begin
  insert into public.issues (house_id, title) values (h, 'ברז מטפטף') returning id into iid;
  insert into ctx values ('issue1', iid::text);
  assert (select updated_by from public.issues where id = iid) is null, 'null on insert';
end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare iid uuid := (select v::uuid from ctx where k='issue1');
begin
  update public.issues set status = 'closed' where id = iid;
  assert (select updated_by from public.issues where id = iid) = 'aaaaaaaa-0000-0000-0000-000000000001', 'updated_by = actor';
  update public.issues set status = 'open', updated_by = 'aaaaaaaa-0000-0000-0000-000000000004' where id = iid;
  assert (select updated_by from public.issues where id = iid) = 'aaaaaaaa-0000-0000-0000-000000000001', 'cannot forge';
end $$;
reset role;
do $$
declare iid uuid := (select v::uuid from ctx where k='issue1');
begin
  perform set_config('request.jwt.claims', '', true);
  update public.issues set status = 'in_progress' where id = iid;
  assert (select updated_by from public.issues where id = iid) is null, 'null when no auth.uid()';
end $$;

do $$ begin raise notice 'ALL FAMILY TESTS PASSED'; end $$;
rollback;
