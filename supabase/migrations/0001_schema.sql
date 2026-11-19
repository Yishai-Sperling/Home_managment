-- 0001_schema.sql — טבלאות, אילוצים וטריגרים. תואם ל-src/types/database.ts
create extension if not exists btree_gist;

-- ───────── profiles ─────────
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  phone            text,
  current_house_id uuid,  -- FK נוסף אחרי יצירת houses
  created_at       timestamptz not null default now()
);

-- ───────── houses ─────────
create table public.houses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  join_code   text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  admin_email text not null,
  created_by  uuid not null,  -- שדה ביקורת; ללא FK כדי שמחיקת משתמש לא תמחק את הבית
  created_at  timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_current_house_fk
  foreign key (current_house_id) references public.houses (id) on delete set null;

-- ───────── house_members ─────────
create table public.house_members (
  house_id  uuid not null references public.houses (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (house_id, user_id)
);
create index house_members_user_idx on public.house_members (user_id);

-- ───────── shopping_items ─────────
create table public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) > 0),
  quantity   text,
  category   text not null default 'other'
             check (category in ('groceries', 'cleaning', 'pharmacy', 'other')),
  status     text not null default 'pending' check (status in ('pending', 'bought')),
  added_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index shopping_items_house_idx on public.shopping_items (house_id, created_at desc);

-- ───────── car_reservations ─────────
create table public.car_reservations (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  purpose    text,
  notes      text,
  created_at timestamptz not null default now(),
  constraint car_reservations_time_check check (ends_at > starts_at),
  -- אין חפיפה בין הזמנות באותו בית (טווח חצי-פתוח: הזמנה צמודה מותרת)
  constraint car_reservations_no_overlap
    exclude using gist (house_id with =, tstzrange(starts_at, ends_at) with &&)
);
create index car_reservations_house_idx on public.car_reservations (house_id, starts_at);

-- ───────── announcements ─────────
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) > 0),
  body       text,
  type       text not null default 'general'
             check (type in ('general', 'event', 'reminder', 'visit')),
  priority   text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  event_date timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index announcements_house_idx on public.announcements (house_id, created_at desc);

-- ───────── issues ─────────
create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references public.houses (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) > 0),
  description text,
  category    text not null default 'general'
              check (category in ('plumbing', 'electric', 'heating', 'appliances', 'general')),
  urgency     text not null default 'normal' check (urgency in ('low', 'normal', 'urgent')),
  status      text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  image_path  text,
  assignee_id uuid references auth.users (id) on delete set null,
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index issues_house_idx on public.issues (house_id, created_at desc);

-- ───────── טריגר: פרופיל אוטומטי בהרשמה ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── טריגר: ניקוי current_house_id כשחבר עוזב/מוסר ─────────
create or replace function public.clear_current_house_on_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set current_house_id = null
   where id = old.user_id and current_house_id = old.house_id;
  return old;
end;
$$;

create trigger house_members_clear_current
  after delete on public.house_members
  for each row execute function public.clear_current_house_on_leave();
