-- בדיקות ל-0012_house_location.sql (אחרי 0001-0004,0006,0007,0009,0010,0012). הרצה:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/location.sql
-- רץ בטרנזקציה ונגמר ב-ROLLBACK. "ALL LOCATION TESTS PASSED" = הצלחה.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com', '{"full_name":"B"}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'c@example.com', '{"full_name":"C"}');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into ctx select 'h1', (select id::text from public.create_house('בית 1'));
insert into ctx select 'code1', (select join_code from public.houses where id = (select v::uuid from ctx where k='h1'));
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into ctx select 'h2', (select id::text from public.create_house('בית 2'));
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- ברירות מחדל ו-join_house
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); r public.houses;
begin
  r := public.join_house((select v from ctx where k='code1'));
  assert r.id = h and r.home_lat is null and r.home_lng is null and r.home_radius_m = 150,
         'join_house returns row with new column defaults';
end $$;

-- מנהל: קביעה, גבולות, שגיאות, ניקוי
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); r public.houses; msg text;
begin
  perform public.set_house_location(h, 32.0853, 34.7818, 200);
  select * into r from public.houses where id = h;
  assert r.home_lat = 32.0853 and r.home_lng = 34.7818 and r.home_radius_m = 200, 'admin set';

  perform public.set_house_location(h, -90, 180, 50);
  select * into r from public.houses where id = h;
  assert r.home_lat = -90 and r.home_lng = 180 and r.home_radius_m = 50, 'boundaries ok';
  perform public.set_house_location(h, 90, -180, 1000);
  assert (select home_radius_m from public.houses where id = h) = 1000, 'radius 1000 ok';

  perform public.set_house_location(h, 32.0, 34.0);
  assert (select home_radius_m from public.houses where id = h) = 150, 'default radius';

  begin perform public.set_house_location(h, 91, 0, 150); assert false, 'lat>90';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'lat>90: ' || msg; end;
  begin perform public.set_house_location(h, -91, 0, 150); assert false, 'lat<-90';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'lat<-90: ' || msg; end;
  begin perform public.set_house_location(h, 0, 181, 150); assert false, 'lng>180';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'lng>180: ' || msg; end;
  begin perform public.set_house_location(h, 0, -181, 150); assert false, 'lng<-180';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'lng<-180: ' || msg; end;
  begin perform public.set_house_location(h, 10, null, 150); assert false, 'half null lng';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'half lng: ' || msg; end;
  begin perform public.set_house_location(h, null, 10, 150); assert false, 'half null lat';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'half lat: ' || msg; end;
  begin perform public.set_house_location(h, 10, 10, 49); assert false, 'radius 49';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'r49: ' || msg; end;
  begin perform public.set_house_location(h, 10, 10, 1001); assert false, 'radius 1001';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'r1001: ' || msg; end;
  begin perform public.set_house_location(h, 10, 10, null); assert false, 'radius null';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'rnull: ' || msg; end;
  begin perform public.set_house_location(h, 'NaN'::float8, 10, 150); assert false, 'nan';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'invalid_location', 'nan: ' || msg; end;
  assert (select home_lat from public.houses where id = h) = 32.0, 'invalid calls changed nothing';

  perform public.set_house_location(h, null, null);
  select * into r from public.houses where id = h;
  assert r.home_lat is null and r.home_lng is null and r.home_radius_m = 150, 'cleared';

  -- עדכון ישיר ע"י מנהל (מדיניות UPDATE קיימת) עדיין כפוף ל-checks
  update public.houses set home_lat = 1, home_lng = 2 where id = h;
  assert (select home_lat from public.houses where id = h) = 1, 'admin direct update ok';
  begin update public.houses set home_lat = null where id = h; assert false, 'pair check';
  exception when check_violation then null; end;
  begin update public.houses set home_lat = 95 where id = h; assert false, 'lat check';
  exception when check_violation then null; end;
  perform public.set_house_location(h, 32.5, 34.5, 300);
end $$;

-- חבר רגיל: קורא, אבל לא כותב
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); r public.houses; msg text; n int;
begin
  select * into r from public.houses where id = h;
  assert r.home_lat = 32.5 and r.home_lng = 34.5 and r.home_radius_m = 300, 'member can read';

  begin perform public.set_house_location(h, 1, 1, 100); assert false, 'member set';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'forbidden', 'member: ' || msg; end;
  begin perform public.set_house_location(h); assert false, 'member clear';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'forbidden', 'member clear: ' || msg; end;

  update public.houses set home_lat = 1, home_lng = 1, home_radius_m = 100 where id = h;
  get diagnostics n = row_count;
  assert n = 0, 'member direct update blocked by RLS';
end $$;

-- זר
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); msg text;
begin
  assert (select count(*) from public.houses where id = h) = 0, 'outsider cannot read';
  begin perform public.set_house_location(h, 1, 1, 100); assert false, 'outsider';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'not_member', 'outsider: ' || msg; end;
end $$;

-- לא מאומת
select set_config('request.jwt.claims', '', true);
do $$
declare h uuid := (select v::uuid from ctx where k='h1'); msg text;
begin
  begin perform public.set_house_location(h, 1, 1, 100); assert false, 'unauth';
  exception when others then get stacked diagnostics msg = message_text; assert msg = 'not_authenticated', 'unauth: ' || msg; end;
end $$;

reset role;
do $$
begin
  assert not has_function_privilege('anon', 'public.set_house_location(uuid,double precision,double precision,integer)', 'execute'), 'anon no execute';
  assert has_function_privilege('authenticated', 'public.set_house_location(uuid,double precision,double precision,integer)', 'execute'), 'authenticated execute';
  assert (select home_lat from public.houses where id = (select v::uuid from ctx where k='h1')) = 32.5, 'unchanged by non-admins';
end $$;

rollback;
\echo ALL LOCATION TESTS PASSED
