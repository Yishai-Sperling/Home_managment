-- בדיקות RLS / אילוצים. הרצה על DB עם המיגרציות 0001-0004 מוחלות:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- הכל רץ בטרנזקציה ונגמר ב-ROLLBACK (לא משאיר נתונים). דורש הרשאת superuser/postgres.
-- כל בדיקה שנכשלת זורקת exception והסקריפט נעצר.

begin;

-- ───────── הכנה (כ-superuser) ─────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', '{"full_name":"Alice"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.com',   '{"full_name":"Bob"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'eve@example.com',   '{"full_name":"Eve"}');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profile trigger should create 3 profiles';
  assert (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Alice';
end $$;

-- Alice יוצרת בית; Bob מצטרף (בלי רגישות לאותיות); Eve יוצרת בית אחר
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
insert into ctx select 'house_a', (select id::text from public.create_house('בית א'));
insert into ctx select 'code_a', (select join_code from public.houses limit 1);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into ctx select 'house_b', (select id::text from public.create_house('בית ב'));

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare c text := (select v from ctx where k = 'code_a'); h1 uuid; h2 uuid;
begin
  assert c ~ '^[A-Z0-9]{6}$', 'join code format';
  h1 := (public.join_house(lower(c))).id;
  h2 := (public.join_house('  ' || c || ' ')).id;   -- idempotent
  assert h1 = h2, 'join_house idempotent';
  assert (select count(*) from public.house_members where house_id = h1) = 2, 'no duplicate membership';
  assert (select current_house_id from public.profiles where id = auth.uid()) = h1, 'current_house_id set';
  begin
    perform public.join_house('ZZZZZZ');
    assert false, 'invalid code should raise';
  exception when others then
    assert sqlerrm = 'invalid_code', 'expected invalid_code, got ' || sqlerrm;
  end;
end $$;

-- ───────── Alice (חברת בית א) ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare ha uuid := (select v::uuid from ctx where k = 'house_a');
begin
  assert (select admin_email from public.houses where id = ha) = 'alice@example.com', 'admin_email from auth';
  assert (select role from public.house_members where house_id = ha and user_id = auth.uid()) = 'admin';

  insert into public.shopping_items (house_id, name, added_by) values (ha, 'חלב', auth.uid());
  insert into public.announcements (house_id, title, created_by) values (ha, 'כותרת', auth.uid());
  insert into public.issues (house_id, title, created_by) values (ha, 'נזילה', auth.uid());
  insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
    values (ha, auth.uid(), '2030-01-01 10:00+00', '2030-01-01 12:00+00');

  -- התנגשות: חפיפה
  begin
    insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
      values (ha, auth.uid(), '2030-01-01 11:00+00', '2030-01-01 13:00+00');
    assert false, 'overlap must be rejected';
  exception when exclusion_violation then null; end;

  -- הזמנה צמודה מותרת
  insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
    values (ha, auth.uid(), '2030-01-01 12:00+00', '2030-01-01 13:00+00');

  -- סוף לפני התחלה
  begin
    insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
      values (ha, auth.uid(), '2030-02-01 12:00+00', '2030-02-01 11:00+00');
    assert false, 'ends_at <= starts_at must be rejected';
  exception when check_violation then null; end;

  -- enum לא חוקי
  begin
    insert into public.shopping_items (house_id, name, category, added_by) values (ha, 'x', 'bogus', auth.uid());
    assert false, 'bad enum';
  exception when check_violation then null; end;
end $$;

-- ───────── Eve (בית ב) לא רואה ולא כותבת לבית א ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare ha uuid := (select v::uuid from ctx where k = 'house_a'); n int; hb uuid := (select v::uuid from ctx where k = 'house_b');
begin
  assert (select count(*) from public.houses where id = ha) = 0, 'Eve must not see house A';
  assert (select count(*) from public.house_members where house_id = ha) = 0, 'Eve must not see A members';
  assert (select count(*) from public.shopping_items) = 0, 'Eve must not see A shopping';
  assert (select count(*) from public.announcements) = 0, 'Eve must not see A announcements';
  assert (select count(*) from public.issues) = 0, 'Eve must not see A issues';
  assert (select count(*) from public.car_reservations) = 0, 'Eve must not see A reservations';
  assert (select count(*) from public.profiles where id <> auth.uid()) = 0, 'Eve must not see A profiles';

  -- הכנסה לבית א נדחית
  begin
    insert into public.shopping_items (house_id, name, added_by) values (ha, 'hack', auth.uid());
    assert false, 'insert into foreign house must fail';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
      values (ha, auth.uid(), '2031-01-01 10:00+00', '2031-01-01 11:00+00');
    assert false, 'reservation into foreign house must fail';
  exception when insufficient_privilege then null; end;

  -- עדכון/מחיקה לא משפיעים (RLS מסנן את השורות)
  update public.shopping_items set name = 'pwned'; get diagnostics n = row_count;
  assert n = 0, 'update must affect 0 rows';
  delete from public.issues; get diagnostics n = row_count;
  assert n = 0, 'delete must affect 0 rows';
  delete from public.house_members where house_id = ha; get diagnostics n = row_count;
  assert n = 0, 'cannot remove foreign members';

  -- אי אפשר להצביע current_house_id על בית זר, ולא להתחזות
  begin
    update public.profiles set current_house_id = ha where id = auth.uid();
    assert false, 'current_house_id foreign house must fail';
  exception when insufficient_privilege then null; end;
  update public.profiles set full_name = 'x' where id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  assert n = 0, 'cannot edit others profile';

  -- אי אפשר ליצור חברות ישירות או בית ישירות
  begin
    insert into public.house_members (house_id, user_id, role) values (ha, auth.uid(), 'admin');
    assert false, 'direct membership insert must fail';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.houses (name, join_code, admin_email, created_by) values ('h', 'ABCDEF', 'e', auth.uid());
    assert false, 'direct house insert must fail';
  exception when insufficient_privilege then null; end;
end $$;

-- ───────── Bob (חבר רגיל בבית א) ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare ha uuid := (select v::uuid from ctx where k = 'house_a'); n int;
begin
  assert (select count(*) from public.shopping_items where house_id = ha) = 1, 'Bob sees house items';
  assert (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Alice', 'co-member profile visible';
  assert (select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 0, 'foreign profile hidden';

  -- יכול לסמן פריט קניות; לא יכול לערוך/למחוק הודעה/תקלה של אחרים
  update public.shopping_items set status = 'bought'; get diagnostics n = row_count;
  assert n = 1, 'member may mark shopping item bought';
  update public.announcements set title = 'x'; get diagnostics n = row_count;
  assert n = 0, 'member cannot edit others announcement';
  delete from public.issues; get diagnostics n = row_count;
  assert n = 0, 'member cannot delete others issue';
  delete from public.car_reservations; get diagnostics n = row_count;
  assert n = 0, 'member cannot delete others reservation';
  delete from public.house_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  assert n = 0, 'member cannot remove admin';
  update public.house_members set role = 'admin' where user_id = auth.uid(); get diagnostics n = row_count;
  assert n = 0, 'member cannot self-promote';

  -- יוצר/ת ופריט משלו
  insert into public.announcements (house_id, title, created_by) values (ha, 'שלי', auth.uid());
  update public.announcements set title = 'שלי2' where title = 'שלי'; get diagnostics n = row_count;
  assert n = 1, 'creator can edit own';
  -- אי אפשר לזייף יוצר
  begin
    insert into public.announcements (house_id, title, created_by)
      values (ha, 'fake', 'aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'spoofed creator must fail';
  exception when insufficient_privilege then null; end;
end $$;

-- ───────── Alice (מנהלת) ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare ha uuid := (select v::uuid from ctx where k = 'house_a'); n int;
begin
  update public.announcements set title = 'admin edit' where title = 'שלי2'; get diagnostics n = row_count;
  assert n = 1, 'admin can edit any';
  delete from public.announcements where title = 'admin edit'; get diagnostics n = row_count;
  assert n = 1, 'admin can delete any';
  -- הסרת חבר
  delete from public.house_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'; get diagnostics n = row_count;
  assert n = 1, 'admin can remove member';
end $$;

-- ───────── אחרי הסרה: Bob איבד גישה ו-current_house_id התנקה ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.shopping_items) = 0, 'removed member loses access';
  assert (select current_house_id from public.profiles where id = auth.uid()) is null, 'current_house_id cleared';
end $$;

-- עזיבה עצמית: Bob מצטרף שוב ועוזב
do $$
declare c text := (select v from ctx where k = 'code_a'); n int;
begin
  perform public.join_house(c);
  delete from public.house_members where user_id = auth.uid(); get diagnostics n = row_count;
  assert n = 1, 'member can leave';
end $$;

-- ───────── anon ─────────
reset role;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.shopping_items;
    assert false, 'anon must be denied';
  exception when insufficient_privilege then null; end;
end $$;

-- ───────── Storage (נתיב <house_id>/<uuid>.jpg) ─────────
reset role;
insert into storage.objects (bucket_id, name, owner)
  select 'issue-images', v || '/11111111-1111-1111-1111-111111111111.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'
  from ctx where k = 'house_a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from storage.objects) = 0, 'outsider cannot read house A images';
  begin
    insert into storage.objects (bucket_id, name, owner)
      values ('issue-images', (select v from ctx where k = 'house_a') || '/22222222-2222-2222-2222-222222222222.jpg', auth.uid());
    assert false, 'outsider cannot upload to house A';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('issue-images', 'not-a-uuid/x.jpg', auth.uid());
    assert false, 'bad path must fail';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare n int;
begin
  assert (select count(*) from storage.objects) = 1, 'member reads own house images';
  delete from storage.objects; get diagnostics n = row_count;
  assert n = 1, 'creator/admin can delete';
end $$;

reset role;
do $$ begin raise notice 'ALL RLS TESTS PASSED'; end $$;
rollback;
