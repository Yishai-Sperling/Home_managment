-- 0010_family_features.sql — נוכחות דיירים, מידע על הבית, מועדפים בקניות, ו-issues.updated_by.
-- בטוח להרצה חוזרת (idempotent). קודי שגיאה (message): not_authenticated | not_member | invalid_status

-- ───────── א. נוכחות ─────────
alter table public.house_members
  add column if not exists presence text,
  add column if not exists presence_eta timestamptz,
  add column if not exists presence_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.house_members'::regclass and conname = 'house_members_presence_check') then
    alter table public.house_members
      add constraint house_members_presence_check check (presence in ('home', 'away', 'soon'));
  end if;
end $$;

-- עדכון נוכחות של המשתמש עצמו בלבד. נוגע רק בעמודות הנוכחות (לא ב-role), ולכן
-- טריגרי guard_last_admin (before update of role) לא מופעלים. אין מדיניות עדכון-עצמי ב-RLS.
create or replace function public.set_presence(p_house uuid, p_status text, p_eta timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_status is not null and p_status not in ('home', 'away', 'soon') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.house_members where house_id = p_house and user_id = v_uid) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  if p_status is null then
    update public.house_members
       set presence = null, presence_eta = null, presence_updated_at = null
     where house_id = p_house and user_id = v_uid;
  else
    update public.house_members
       set presence = p_status,
           presence_eta = case when p_status = 'soon' then p_eta else null end,
           presence_updated_at = now()
     where house_id = p_house and user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.set_presence(uuid, text, timestamptz) from public, anon;
grant execute on function public.set_presence(uuid, text, timestamptz) to authenticated, service_role;

-- ───────── ב. מידע על הבית ─────────
create table if not exists public.house_info_items (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 80),
  value      text not null check (char_length(value) between 1 and 500),
  kind       text not null default 'text' check (kind in ('text', 'wifi', 'phone', 'code', 'link')),
  is_secret  boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists house_info_items_house_idx on public.house_info_items (house_id, created_at);

create or replace function public.house_info_items_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  new.created_by := old.created_by;  -- היוצר אינו ניתן לשינוי
  new.house_id   := old.house_id;
  return new;
end;
$$;
drop trigger if exists house_info_items_touch on public.house_info_items;
create trigger house_info_items_touch before update on public.house_info_items
  for each row execute function public.house_info_items_before_update();

alter table public.house_info_items enable row level security;
revoke all on public.house_info_items from anon;
grant select, insert, update, delete on public.house_info_items to authenticated;

drop policy if exists house_info_items_select on public.house_info_items;
create policy house_info_items_select on public.house_info_items for select to authenticated
  using (public.is_house_member(house_id));
drop policy if exists house_info_items_insert on public.house_info_items;
create policy house_info_items_insert on public.house_info_items for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
drop policy if exists house_info_items_update on public.house_info_items;
create policy house_info_items_update on public.house_info_items for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
drop policy if exists house_info_items_delete on public.house_info_items;
create policy house_info_items_delete on public.house_info_items for delete to authenticated
  using (public.is_house_admin(house_id) or created_by = (select auth.uid()));

-- ───────── ג. מועדפים בקניות ─────────
create table if not exists public.shopping_favorites (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  quantity   text,
  category   text not null default 'other' check (category in ('groceries', 'cleaning', 'pharmacy', 'other')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists shopping_favorites_house_name_uq
  on public.shopping_favorites (house_id, lower(name));

alter table public.shopping_favorites enable row level security;
revoke all on public.shopping_favorites from anon;
grant select, insert, update, delete on public.shopping_favorites to authenticated;

drop policy if exists shopping_favorites_select on public.shopping_favorites;
create policy shopping_favorites_select on public.shopping_favorites for select to authenticated
  using (public.is_house_member(house_id));
drop policy if exists shopping_favorites_insert on public.shopping_favorites;
create policy shopping_favorites_insert on public.shopping_favorites for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
drop policy if exists shopping_favorites_update on public.shopping_favorites;
create policy shopping_favorites_update on public.shopping_favorites for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
drop policy if exists shopping_favorites_delete on public.shopping_favorites;
create policy shopping_favorites_delete on public.shopping_favorites for delete to authenticated
  using (public.is_house_member(house_id));

-- ───────── Realtime ─────────
alter table public.house_info_items  replica identity full;
alter table public.shopping_favorites replica identity full;
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['house_info_items', 'shopping_favorites']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ───────── ד. issues.updated_by ─────────
-- מי ביצע את העדכון (נקרא ע"י ה-Webhook של UPDATE). null כשאין auth.uid() (למשל service role).
alter table public.issues add column if not exists updated_by uuid;

create or replace function public.issues_set_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists issues_set_updated_by on public.issues;
create trigger issues_set_updated_by before update on public.issues
  for each row execute function public.issues_set_updated_by();
