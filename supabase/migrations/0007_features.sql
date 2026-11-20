-- 0007_features.sql — העדפות התראות, הגנת "מנהל אחרון", ושריון חוזר לרכב.
-- אפשר להריץ שוב בבטחה (idempotent). קודי שגיאה (message):
--   not_authenticated | not_member | forbidden | invalid_days | invalid_time | not_found | last_admin

-- ───────── א. העדפות התראות ─────────
alter table public.profiles
  add column if not exists notify_prefs jsonb not null
  default '{"shopping":true,"car":true,"announcements":true,"issues":true}'::jsonb;

-- ───────── ב. הגנת מנהל אחרון ─────────
-- מחיקת בית שלם (cascade) ועזיבה של החבר היחיד מותרות; אחרת חייב להישאר מנהל.
-- (ב-cascade מחיקת הבית כבר בוצעה כשהטריגר רץ, לכן שורת houses כבר לא נראית.)
-- הערה: מחיקת משתמש (auth.users) שהוא המנהל האחרון בבית עם חברים נוספים תיחסם גם היא.
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'admin' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;
  if not exists (select 1 from public.houses where id = old.house_id) then
    return case tg_op when 'DELETE' then old else new end;  -- הבית נמחק
  end if;
  if exists (select 1 from public.house_members
             where house_id = old.house_id and user_id <> old.user_id)
     and not exists (select 1 from public.house_members
                     where house_id = old.house_id and user_id <> old.user_id and role = 'admin')
  then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists house_members_guard_last_admin_upd on public.house_members;
create trigger house_members_guard_last_admin_upd
  before update of role on public.house_members
  for each row execute function public.guard_last_admin();

drop trigger if exists house_members_guard_last_admin_del on public.house_members;
create trigger house_members_guard_last_admin_del
  before delete on public.house_members
  for each row execute function public.guard_last_admin();

-- profiles.current_house_id כבר מוגדר עם FK ... on delete set null (0001); מוודאים בכל זאת.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and confrelid = 'public.houses'::regclass and confdeltype = 'n'
  ) then
    alter table public.profiles drop constraint if exists profiles_current_house_fk;
    alter table public.profiles add constraint profiles_current_house_fk
      foreign key (current_house_id) references public.houses (id) on delete set null;
  end if;
end $$;

-- ───────── ג. שריון חוזר ─────────
create table if not exists public.car_recurring_rules (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  days       smallint[] not null,
  start_time time not null,
  end_time   time not null,
  tz         text not null default 'Asia/Jerusalem',
  purpose    text,
  starts_on  date not null default current_date,
  ends_on    date,
  created_at timestamptz not null default now(),
  constraint car_recurring_rules_time_check check (end_time > start_time),
  constraint car_recurring_rules_days_check
    check (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint car_recurring_rules_range_check check (ends_on is null or ends_on >= starts_on)
);
create index if not exists car_recurring_rules_house_idx on public.car_recurring_rules (house_id);

alter table public.car_reservations
  add column if not exists recurring_rule_id uuid references public.car_recurring_rules (id) on delete set null,
  add column if not exists occurrence_date date;

create unique index if not exists car_reservations_rule_occurrence_uq
  on public.car_reservations (recurring_rule_id, occurrence_date)
  where recurring_rule_id is not null;

create table if not exists public.car_recurring_skips (
  rule_id         uuid not null references public.car_recurring_rules (id) on delete cascade,
  occurrence_date date not null,
  primary key (rule_id, occurrence_date)
);

alter table public.car_recurring_rules enable row level security;
alter table public.car_recurring_skips enable row level security;

revoke all on public.car_recurring_rules, public.car_recurring_skips from anon, authenticated;
grant select on public.car_recurring_rules to authenticated;

drop policy if exists car_recurring_rules_select on public.car_recurring_rules;
create policy car_recurring_rules_select on public.car_recurring_rules for select to authenticated
  using (public.is_house_member(house_id));
-- אין insert/update/delete ישיר: רק דרך ה-RPC. ל-car_recurring_skips אין מדיניות כלל.

alter table public.car_recurring_rules replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'car_recurring_rules'
  ) then
    alter publication supabase_realtime add table public.car_recurring_rules;
  end if;
end $$;

-- ───────── פנימי: יצירת המופעים (ללא בדיקת הרשאות; לא חשוף ללקוחות) ─────────
create or replace function public._materialize_recurring(p_house uuid, p_days int, p_rule uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         public.car_recurring_rules;
  v_today   date;
  d         date;
  v_start   timestamptz;
  v_end     timestamptz;
  v_n       int;
  v_created int := 0;
  v_conf    int := 0;
begin
  v_n := least(greatest(coalesce(p_days, 28), 1), 90);
  for r in
    select * from public.car_recurring_rules
    where house_id = p_house and (p_rule is null or id = p_rule)
  loop
    v_today := (now() at time zone r.tz)::date;
    for d in select g::date from generate_series(
               greatest(v_today, r.starts_on)::timestamp,
               least(v_today + v_n, coalesce(r.ends_on, v_today + v_n))::timestamp,
               interval '1 day') g
    loop
      continue when not (extract(dow from d)::smallint = any (r.days));
      continue when exists (select 1 from public.car_recurring_skips where rule_id = r.id and occurrence_date = d);
      v_start := (d + r.start_time) at time zone r.tz;
      v_end   := (d + r.end_time)   at time zone r.tz;
      continue when v_end <= now();
      begin
        insert into public.car_reservations
          (house_id, user_id, starts_at, ends_at, purpose, recurring_rule_id, occurrence_date)
        values (r.house_id, r.user_id, v_start, v_end, r.purpose, r.id, d)
        on conflict (recurring_rule_id, occurrence_date) where recurring_rule_id is not null do nothing;
        if found then v_created := v_created + 1; end if;
      exception when exclusion_violation then
        v_conf := v_conf + 1;
      end;
    end loop;
  end loop;
  return jsonb_build_object('created', v_created, 'conflicts', v_conf);
end;
$$;

revoke all on function public._materialize_recurring(uuid, int, uuid) from public, anon, authenticated;

-- בדיקת קלט משותפת: מחזירה ימים ממוינים וייחודיים
create or replace function public._clean_days(p_days int[])
returns smallint[]
language plpgsql
immutable
set search_path = ''
as $$
declare v smallint[];
begin
  if p_days is null or cardinality(p_days) = 0
     or exists (select 1 from unnest(p_days) x where x is null or x not between 0 and 6) then
    raise exception 'invalid_days' using errcode = 'P0001';
  end if;
  select array_agg(distinct x::smallint order by x::smallint) into v from unnest(p_days) x;
  return v;
end;
$$;
revoke all on function public._clean_days(int[]) from public, anon, authenticated;

-- ───────── RPC ─────────
create or replace function public.create_recurring_rule(
  p_house uuid, p_days int[], p_start time, p_end time,
  p_purpose text default null, p_ends_on date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_days smallint[];
  v_rule public.car_recurring_rules;
  v_res  jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.house_members where house_id = p_house and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  v_days := public._clean_days(p_days);
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and p_ends_on < (now() at time zone 'Asia/Jerusalem')::date then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;

  insert into public.car_recurring_rules (house_id, user_id, days, start_time, end_time, purpose, starts_on, ends_on)
  values (p_house, v_uid, v_days, p_start, p_end, nullif(btrim(coalesce(p_purpose, '')), ''),
          (now() at time zone 'Asia/Jerusalem')::date, p_ends_on)
  returning * into v_rule;

  v_res := public._materialize_recurring(p_house, 28, v_rule.id);
  return jsonb_build_object('rule_id', v_rule.id) || v_res;
end;
$$;

create or replace function public.materialize_recurring(p_house uuid, p_days int default 28)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.house_members where house_id = p_house and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  return (public._materialize_recurring(p_house, p_days, null) ->> 'created')::int;
end;
$$;

create or replace function public.skip_occurrence(p_reservation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_res  public.car_reservations;
  v_rule public.car_recurring_rules;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_res from public.car_reservations where id = p_reservation;
  if not found or v_res.recurring_rule_id is null or v_res.occurrence_date is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.house_members where house_id = v_res.house_id and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  select * into v_rule from public.car_recurring_rules where id = v_res.recurring_rule_id;
  if v_rule.user_id <> v_uid and not exists (
       select 1 from public.house_members where house_id = v_res.house_id and user_id = v_uid and role = 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  insert into public.car_recurring_skips (rule_id, occurrence_date)
  values (v_res.recurring_rule_id, v_res.occurrence_date) on conflict do nothing;
  delete from public.car_reservations where id = p_reservation;
end;
$$;

create or replace function public.delete_recurring_rule(p_rule uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_rule public.car_recurring_rules;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_rule from public.car_recurring_rules where id = p_rule;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.house_members where house_id = v_rule.house_id and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_rule.user_id <> v_uid and not exists (
       select 1 from public.house_members where house_id = v_rule.house_id and user_id = v_uid and role = 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from public.car_reservations where recurring_rule_id = p_rule and starts_at >= now();
  delete from public.car_recurring_rules where id = p_rule;  -- עבר נשאר, עם recurring_rule_id = null
end;
$$;

create or replace function public.update_recurring_rule(
  p_rule uuid, p_days int[], p_start time, p_end time, p_purpose text, p_ends_on date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_rule  public.car_recurring_rules;
  v_days  smallint[];
  v_today date;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_rule from public.car_recurring_rules where id = p_rule for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.house_members where house_id = v_rule.house_id and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_rule.user_id <> v_uid and not exists (
       select 1 from public.house_members where house_id = v_rule.house_id and user_id = v_uid and role = 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_days := public._clean_days(p_days);
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;
  v_today := (now() at time zone v_rule.tz)::date;
  if p_ends_on is not null and p_ends_on < least(v_rule.starts_on, v_today) then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;

  update public.car_recurring_rules
     set days = v_days, start_time = p_start, end_time = p_end,
         purpose = nullif(btrim(coalesce(p_purpose, '')), ''), ends_on = p_ends_on
   where id = p_rule;
  delete from public.car_reservations where recurring_rule_id = p_rule and starts_at >= now();
  delete from public.car_recurring_skips where rule_id = p_rule and occurrence_date >= v_today;

  v_res := public._materialize_recurring(v_rule.house_id, 28, p_rule);
  return jsonb_build_object('rule_id', p_rule) || v_res;
end;
$$;

revoke all on function
  public.create_recurring_rule(uuid, int[], time, time, text, date),
  public.materialize_recurring(uuid, int),
  public.skip_occurrence(uuid),
  public.delete_recurring_rule(uuid),
  public.update_recurring_rule(uuid, int[], time, time, text, date)
  from public, anon;
grant execute on function
  public.create_recurring_rule(uuid, int[], time, time, text, date),
  public.materialize_recurring(uuid, int),
  public.skip_occurrence(uuid),
  public.delete_recurring_rule(uuid),
  public.update_recurring_rule(uuid, int[], time, time, text, date)
  to authenticated, service_role;
