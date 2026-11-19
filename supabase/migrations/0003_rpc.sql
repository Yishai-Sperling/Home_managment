-- 0003_rpc.sql — create_house / join_house ו-Realtime
-- קודי שגיאה (message) שהאפליקציה ממפה להודעה בעברית:
--   not_authenticated | invalid_name | invalid_code

create or replace function public.create_house(p_name text)
returns public.houses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_code  text;
  v_house public.houses;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- בלי 0/O/1/I
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 or char_length(btrim(p_name)) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.houses where join_code = v_code);
  end loop;

  insert into public.houses (name, join_code, admin_email, created_by)
  values (btrim(p_name), v_code, coalesce(v_email, ''), v_uid)
  returning * into v_house;

  insert into public.house_members (house_id, user_id, role)
  values (v_house.id, v_uid, 'admin');

  update public.profiles set current_house_id = v_house.id where id = v_uid;

  return v_house;
end;
$$;

create or replace function public.join_house(p_code text)
returns public.houses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_house public.houses;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_house from public.houses
  where join_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  insert into public.house_members (house_id, user_id, role)
  values (v_house.id, v_uid, 'member')
  on conflict (house_id, user_id) do nothing;

  update public.profiles set current_house_id = v_house.id where id = v_uid;

  return v_house;
end;
$$;

revoke all on function public.create_house(text), public.join_house(text) from public, anon;
grant execute on function public.create_house(text), public.join_house(text)
  to authenticated, service_role;

-- ───────── Realtime ─────────
-- REPLICA IDENTITY FULL כדי שאירועי DELETE/UPDATE יכללו את כל העמודות (סינון לפי house_id)
alter table public.shopping_items   replica identity full;
alter table public.car_reservations replica identity full;
alter table public.announcements    replica identity full;
alter table public.issues           replica identity full;
alter table public.house_members    replica identity full;

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['shopping_items','car_reservations','announcements','issues','house_members']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
