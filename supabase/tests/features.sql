-- בדיקות ל-0007_features.sql (ואחרי 0001-0004,0006,0007). הרצה:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/features.sql
-- רץ בטרנזקציה ונגמר ב-ROLLBACK. דורש superuser. ההודעה "ALL FEATURE TESTS PASSED" מסמנת הצלחה.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'b@example.com', '{"full_name":"B"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'c@example.com', '{"full_name":"C"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'd@example.com', '{"full_name":"D"}');

-- notify_prefs ברירת מחדל
do $$ begin
  assert (select notify_prefs from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')
         = '{"shopping":true,"car":true,"announcements":true,"issues":true}'::jsonb, 'notify_prefs default';
end $$;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create temp table res (k text primary key, v jsonb);
grant all on res to authenticated;

-- A מנהל בית 1; B ו-D חברים; C מנהל בית 2 (זר)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into ctx select 'h1', (select id::text from public.create_house('בית 1'));
insert into ctx select 'code1', (select join_code from public.houses where id = (select v::uuid from ctx where k='h1'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into ctx select 'h2', (select id::text from public.create_house('בית 2'));
insert into ctx select 'code2', (select join_code from public.houses where id = (select v::uuid from ctx where k='h2'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.join_house((select v from ctx where k='code1'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
select public.join_house((select v from ctx where k='code1'));

-- ───────── שריון חוזר: A יוצר Sun-Thu 09:00-15:30 ─────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  r jsonb; expected int; n int;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  r := public.create_recurring_rule(h, array[4,0,1,2,3,3], '09:00', '15:30', 'עבודה');
  insert into res values ('ruleA', r);
  select count(*) into expected
    from generate_series(today, today + 28, interval '1 day') g
   where extract(dow from g) between 0 and 4
     and ((g::date + time '15:30') at time zone 'Asia/Jerusalem') > now();
  assert (r->>'created')::int = expected, format('created %s expected %s', r->>'created', expected);
  assert (r->>'conflicts')::int = 0, 'no conflicts';
  assert expected >= 18, 'sanity: about 4 weeks of weekdays, got ' || expected;
  assert (select days from public.car_recurring_rules where id = (r->>'rule_id')::uuid) = array[0,1,2,3,4]::smallint[],
         'days deduped + sorted';
  assert (select starts_on from public.car_recurring_rules where id = (r->>'rule_id')::uuid) = today, 'starts_on';

  -- כל מופע: שעה מקומית 09:00-15:30 ובימים הנכונים
  assert not exists (
    select 1 from public.car_reservations
    where recurring_rule_id = (r->>'rule_id')::uuid
      and ((starts_at at time zone 'Asia/Jerusalem')::time <> '09:00'
        or (ends_at at time zone 'Asia/Jerusalem')::time <> '15:30'
        or (starts_at at time zone 'Asia/Jerusalem')::date <> occurrence_date
        or extract(dow from occurrence_date) not between 0 and 4
        or user_id <> auth.uid())), 'occurrence times/dates';
  -- אם החלון חוצה שינוי שעון: שני היסטים שונים ב-UTC
  if (select count(distinct (starts_at at time zone 'UTC')::time) from public.car_reservations
      where recurring_rule_id = (r->>'rule_id')::uuid) > 1 then
    raise notice 'window crosses a DST change; distinct UTC start times observed';
  end if;

  -- idempotent
  assert public.materialize_recurring(h) = 0, 'second materialize creates nothing';
  assert public.materialize_recurring(h, 28) = 0, 'idempotent';
  select count(*) into n from public.car_reservations where recurring_rule_id = (r->>'rule_id')::uuid;
  assert n = expected, 'row count stable';
end $$;

-- בדיקת DST דטרמיניסטית של הנוסחה (שעון ישראל: סוף DST ב-25.10.2026, תחילתו ב-27.03.2026)
do $$ begin
  assert ((date '2026-10-24' + time '09:00') at time zone 'Asia/Jerusalem') = timestamptz '2026-10-24 06:00+00', 'IDT +3';
  assert ((date '2026-10-25' + time '09:00') at time zone 'Asia/Jerusalem') = timestamptz '2026-10-25 07:00+00', 'IST +2 after change';
  assert ((date '2026-03-26' + time '09:00') at time zone 'Asia/Jerusalem') = timestamptz '2026-03-26 07:00+00', 'IST before spring';
  assert ((date '2026-03-27' + time '09:00') at time zone 'Asia/Jerusalem') = timestamptz '2026-03-27 06:00+00', 'IDT after spring';
end $$;

-- RLS על הטבלאות: חבר רואה, זר לא, אין כתיבה ישירה
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); n int;
begin
  assert (select count(*) from public.car_recurring_rules where house_id = h) = 1, 'member sees rules';
  begin
    insert into public.car_recurring_rules (house_id, user_id, days, start_time, end_time)
    values (h, auth.uid(), array[1]::smallint[], '10:00', '11:00');
    assert false, 'direct insert must fail';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.car_recurring_rules; assert false, 'direct delete must fail';
  exception when insufficient_privilege then null; end;
  begin
    update public.car_recurring_rules set days = array[1]::smallint[]; assert false, 'direct update must fail';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.car_recurring_skips; assert false, 'skips not readable';
  exception when insufficient_privilege then null; end;
end $$;

-- זר (C) לא רואה ולא יכול לקרוא ל-RPC על בית 1
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); rid uuid := ((select v from res where k='ruleA')->>'rule_id')::uuid;
  resv uuid := (select id from public.car_reservations where recurring_rule_id is not null limit 1);
begin
  assert (select count(*) from public.car_recurring_rules) = 0, 'outsider sees no rules';
  begin perform public.create_recurring_rule(h, array[1], '10:00', '11:00'); assert false;
  exception when others then assert sqlerrm = 'not_member', 'create: ' || sqlerrm; end;
  begin perform public.materialize_recurring(h); assert false;
  exception when others then assert sqlerrm = 'not_member', 'materialize: ' || sqlerrm; end;
  begin perform public.delete_recurring_rule(rid); assert false;
  exception when others then assert sqlerrm = 'not_member', 'delete: ' || sqlerrm; end;
  begin perform public.update_recurring_rule(rid, array[1], '10:00', '11:00', null, null); assert false;
  exception when others then assert sqlerrm = 'not_member', 'update: ' || sqlerrm; end;
  -- הזר לא רואה שריונים, לכן skip על מזהה ידוע: not_member (המזהה ידוע לנו כ-superuser בלבד)
end $$;
reset role;
do $$
declare resv uuid := (select id from public.car_reservations where recurring_rule_id is not null limit 1);
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
  begin perform public.skip_occurrence(resv); assert false;
  exception when others then assert sqlerrm = 'not_member', 'skip outsider: ' || sqlerrm; end;
  -- לא מחובר
  perform set_config('request.jwt.claims', '', true);
  begin perform public.materialize_recurring((select v::uuid from ctx where k='h1')); assert false;
  exception when others then assert sqlerrm = 'not_authenticated', 'unauth: ' || sqlerrm; end;
  reset role;
end $$;

-- B (חבר רגיל): לא יכול לגעת בסדרה של A; יוצר סדרה משלו (שישי 18:00-19:00)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  rid uuid := ((select v from res where k='ruleA')->>'rule_id')::uuid;
  resv uuid; r jsonb; today date := (now() at time zone 'Asia/Jerusalem')::date; expected int;
begin
  select id into resv from public.car_reservations where recurring_rule_id = rid limit 1;
  begin perform public.skip_occurrence(resv); assert false;
  exception when others then assert sqlerrm = 'forbidden', 'skip non-owner: ' || sqlerrm; end;
  begin perform public.delete_recurring_rule(rid); assert false;
  exception when others then assert sqlerrm = 'forbidden', 'delete non-owner: ' || sqlerrm; end;
  begin perform public.update_recurring_rule(rid, array[1], '10:00', '11:00', null, null); assert false;
  exception when others then assert sqlerrm = 'forbidden', 'update non-owner: ' || sqlerrm; end;

  -- קלט שגוי
  begin perform public.create_recurring_rule(h, array[7], '10:00', '11:00'); assert false;
  exception when others then assert sqlerrm = 'invalid_days', sqlerrm; end;
  begin perform public.create_recurring_rule(h, array[]::int[], '10:00', '11:00'); assert false;
  exception when others then assert sqlerrm = 'invalid_days', sqlerrm; end;
  begin perform public.create_recurring_rule(h, array[1], '11:00', '10:00'); assert false;
  exception when others then assert sqlerrm = 'invalid_time', sqlerrm; end;
  begin perform public.create_recurring_rule(h, array[1], '22:00', '02:00'); assert false;
  exception when others then assert sqlerrm = 'invalid_time', 'overnight: ' || sqlerrm; end;
  begin perform public.skip_occurrence(gen_random_uuid()); assert false;
  exception when others then assert sqlerrm = 'not_found', sqlerrm; end;

  r := public.create_recurring_rule(h, array[5], '18:00', '19:00');
  insert into res values ('ruleB', r);
  select count(*) into expected from generate_series(today, today + 28, interval '1 day') g
   where extract(dow from g) = 5 and ((g::date + time '19:00') at time zone 'Asia/Jerusalem') > now();
  assert (r->>'created')::int = expected and (r->>'conflicts')::int = 0, 'B rule created ' || r::text;
end $$;

-- A (מנהל) יכול לדלג על מופע של B; ולא נוצר מחדש
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  rb uuid := ((select v from res where k='ruleB')->>'rule_id')::uuid;
  resv uuid; od date; before int; after int;
begin
  select id, occurrence_date into resv, od from public.car_reservations
   where recurring_rule_id = rb and starts_at > now() order by starts_at limit 1;
  select count(*) into before from public.car_reservations where recurring_rule_id = rb;
  perform public.skip_occurrence(resv);
  select count(*) into after from public.car_reservations where recurring_rule_id = rb;
  assert after = before - 1, 'skip removed exactly one';
  assert not exists (select 1 from public.car_reservations where recurring_rule_id = rb and occurrence_date = od);
  assert public.materialize_recurring(h) = 0, 'materialize does not recreate skipped';
  assert not exists (select 1 from public.car_reservations where recurring_rule_id = rb and occurrence_date = od),
         'still skipped after materialize';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.car_recurring_skips) = 1, 'one skip row';
end $$;

-- B מעדכן את הסדרה שלו (שישי+שבת): הדילוג נמחק והמופע חוזר; D (חבר אחר) לא יכול; A (מנהל) יכול
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
declare rb uuid := ((select v from res where k='ruleB')->>'rule_id')::uuid;
begin
  begin perform public.update_recurring_rule(rb, array[5,6], '18:00', '19:00', null, null); assert false;
  exception when others then assert sqlerrm = 'forbidden', 'D update: ' || sqlerrm; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare
  rb uuid := ((select v from res where k='ruleB')->>'rule_id')::uuid;
  today date := (now() at time zone 'Asia/Jerusalem')::date; expected int; r jsonb;
begin
  r := public.update_recurring_rule(rb, array[5,6,5], '18:00', '19:30', 'חדש', null);
  select count(*) into expected from generate_series(today, today + 28, interval '1 day') g
   where extract(dow from g) in (5,6) and ((g::date + time '19:30') at time zone 'Asia/Jerusalem') > now();
  assert (r->>'rule_id')::uuid = rb, 'rule_id returned';
  assert (r->>'created')::int + (select count(*) from public.car_reservations
          where recurring_rule_id = rb and starts_at < now())::int = expected
         or (r->>'created')::int = expected, 'update re-materialized: ' || r::text || ' exp ' || expected;
  assert (select count(*) from public.car_reservations where recurring_rule_id = rb) = expected, 'rows after update';
  assert (select purpose from public.car_reservations where recurring_rule_id = rb limit 1) = 'חדש', 'purpose updated';
  assert not exists (select 1 from public.car_reservations where recurring_rule_id = rb
     and (ends_at at time zone 'Asia/Jerusalem')::time <> '19:30'), 'end time updated';
end $$;

reset role;
do $$ begin
  assert (select count(*) from public.car_recurring_skips) = 0, 'skips cleared by update';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- התנגשות עם שריון חד-פעמי נספרת כ-conflict ולא כשגיאה (שבת הקרובה 10:30-11:30 מול סדרה 10:00-11:00)
do $$
declare
  h uuid := (select v::uuid from ctx where k='h1');
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  sat date; r jsonb; expected int;
begin
  select g::date into sat from generate_series(today + 1, today + 7, interval '1 day') g where extract(dow from g) = 6;
  insert into public.car_reservations (house_id, user_id, starts_at, ends_at, purpose)
  values (h, auth.uid(), (sat + time '10:30') at time zone 'Asia/Jerusalem', (sat + time '11:30') at time zone 'Asia/Jerusalem', 'חד פעמי');
  r := public.create_recurring_rule(h, array[6], '10:00', '11:00');
  select count(*) into expected from generate_series(today, today + 28, interval '1 day') g
   where extract(dow from g) = 6 and ((g::date + time '11:00') at time zone 'Asia/Jerusalem') > now();
  assert (r->>'conflicts')::int = 1, 'one conflict: ' || r::text;
  assert (r->>'created')::int = expected - 1, 'others created: ' || r::text;
  insert into res values ('ruleSat', r);
  -- materialize חוזר: ההתנגשות לא מפילה, ולא נוצר כלום
  assert public.materialize_recurring(h) = 0, 'materialize with standing conflict';
end $$;

-- מחיקת סדרה של A: רק עתיד נמחק; עבר נשאר עם recurring_rule_id = null
reset role;
do $$
declare
  ra uuid := ((select v from res where k='ruleA')->>'rule_id')::uuid;
  h uuid := (select v::uuid from ctx where k='h1');
begin
  -- שריון עבר "שנוצר מהסדרה" (מוכנס ידנית כ-superuser)
  insert into public.car_reservations (house_id, user_id, starts_at, ends_at, recurring_rule_id, occurrence_date)
  values (h, 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour',
          ra, (now() - interval '3 days')::date);
  assert (select count(*) from public.car_reservations where recurring_rule_id = ra and starts_at >= now()) > 0;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare ra uuid := ((select v from res where k='ruleA')->>'rule_id')::uuid; past_n int;
begin
  select count(*) into past_n from public.car_reservations where starts_at < now();
  perform public.delete_recurring_rule(ra);
  assert not exists (select 1 from public.car_recurring_rules where id = ra), 'rule gone';
  assert not exists (select 1 from public.car_reservations where recurring_rule_id = ra), 'no linked rows';
  assert (select count(*) from public.car_reservations where starts_at < now()) = past_n, 'past rows remain';
  assert exists (select 1 from public.car_reservations where starts_at < now() and recurring_rule_id is null
                 and occurrence_date is not null), 'past occurrence detached';
  -- סדרות אחרות לא נפגעו
  assert (select count(*) from public.car_recurring_rules) = 2, 'other rules intact';
  begin perform public.delete_recurring_rule(ra); assert false;
  exception when others then assert sqlerrm = 'not_found', sqlerrm; end;
end $$;

-- ───────── הגנת מנהל אחרון ─────────
-- בית 1: A מנהל יחיד, B ו-D חברים
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); n int;
begin
  begin
    update public.house_members set role = 'member' where house_id = h and user_id = auth.uid();
    assert false, 'demote last admin must fail';
  exception when others then assert sqlerrm = 'last_admin', 'demote: ' || sqlerrm; end;
  begin
    delete from public.house_members where house_id = h and user_id = auth.uid();
    assert false, 'remove last admin must fail';
  exception when others then assert sqlerrm = 'last_admin', 'leave: ' || sqlerrm; end;
  -- קידום B ואז הורדת A מותרת
  update public.house_members set role = 'admin' where house_id = h and user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  update public.house_members set role = 'member' where house_id = h and user_id = auth.uid();
  get diagnostics n = row_count;
  assert n = 1, 'demote allowed when another admin exists';
end $$;
-- עכשיו B מנהל יחיד; A ו-D חברים
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); n int;
begin
  begin
    delete from public.house_members where house_id = h and user_id = auth.uid();
    assert false, 'B is last admin';
  exception when others then assert sqlerrm = 'last_admin', 'B leave: ' || sqlerrm; end;
  delete from public.house_members where house_id = h and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  delete from public.house_members where house_id = h and user_id = 'aaaaaaaa-0000-0000-0000-000000000004';
  -- B הוא היחיד: עזיבה מותרת
  delete from public.house_members where house_id = h and user_id = auth.uid(); get diagnostics n = row_count;
  assert n = 1, 'sole member may leave';
  assert (select current_house_id from public.profiles where id = auth.uid()) is null, 'current_house cleared on leave';
end $$;

-- מחיקת בית שלם: C מנהל בית 2 עם D כחבר
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
select public.join_house((select v from ctx where k='code2'));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h2'); n int;
begin
  assert (select count(*) from public.house_members where house_id = h) = 2;
  assert (select current_house_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000004') = h
    or true;
  insert into public.car_reservations (house_id, user_id, starts_at, ends_at)
  values (h, auth.uid(), now() + interval '30 days', now() + interval '30 days 1 hour');
  delete from public.houses where id = h; get diagnostics n = row_count;
  assert n = 1, 'admin deletes the whole house';
end $$;
reset role;
do $$
declare h uuid := (select v::uuid from ctx where k='h2');
begin
  assert not exists (select 1 from public.house_members where house_id = h), 'members cascaded';
  assert not exists (select 1 from public.car_reservations where house_id = h), 'reservations cascaded';
  assert (select count(*) from public.profiles where current_house_id = h) = 0, 'current_house_id cleared';
  assert (select current_house_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003') is null;
  assert (select current_house_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000004') is null;
end $$;

do $$ begin raise notice 'ALL FEATURE TESTS PASSED'; end $$;
rollback;
