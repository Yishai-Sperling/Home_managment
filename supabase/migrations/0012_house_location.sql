-- 0012_house_location.sql — מיקום הבית (לזיהוי "בבית" אוטומטי). בטוח להרצה חוזרת (idempotent).
-- קודי שגיאה (message): not_authenticated | not_member | forbidden | invalid_location

alter table public.houses
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists home_radius_m integer not null default 150;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.houses'::regclass and conname = 'houses_home_lat_check') then
    alter table public.houses add constraint houses_home_lat_check check (home_lat between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.houses'::regclass and conname = 'houses_home_lng_check') then
    alter table public.houses add constraint houses_home_lng_check check (home_lng between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.houses'::regclass and conname = 'houses_home_radius_check') then
    alter table public.houses add constraint houses_home_radius_check check (home_radius_m between 50 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.houses'::regclass and conname = 'houses_home_latlng_pair_check') then
    alter table public.houses add constraint houses_home_latlng_pair_check
      check ((home_lat is null) = (home_lng is null));
  end if;
end $$;

-- קריאה: מדיניות ה-SELECT הקיימת (חברי הבית). כתיבה: מנהל בלבד (RPC זה או מדיניות ה-UPDATE הקיימת).
create or replace function public.set_house_location(
  p_house uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 150
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select role into v_role from public.house_members where house_id = p_house and user_id = v_uid;
  if not found then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_role <> 'admin' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_lat is null and p_lng is null then
    update public.houses set home_lat = null, home_lng = null, home_radius_m = 150 where id = p_house;
    return;
  end if;

  if p_lat is null or p_lng is null
     or p_lat <> p_lat or p_lng <> p_lng  -- NaN
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180
     or p_radius_m is null or p_radius_m not between 50 and 1000 then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;

  update public.houses
     set home_lat = p_lat, home_lng = p_lng, home_radius_m = p_radius_m
   where id = p_house;
end;
$$;

revoke all on function public.set_house_location(uuid, double precision, double precision, integer) from public, anon;
grant execute on function public.set_house_location(uuid, double precision, double precision, integer) to authenticated, service_role;
