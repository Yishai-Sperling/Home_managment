-- 0002_rls.sql — מדיניות אבטחה ברמת שורה (RLS)

-- ───────── פונקציות עזר (security definer כדי למנוע רקורסיה ב-RLS) ─────────
create or replace function public.is_house_member(house uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.house_members
    where house_id = house and user_id = auth.uid()
  );
$$;

create or replace function public.is_house_admin(house uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.house_members
    where house_id = house and user_id = auth.uid() and role = 'admin'
  );
$$;

-- האם למשתמש הנוכחי ולמשתמש אחר יש בית משותף
create or replace function public.shares_house_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.house_members a
    join public.house_members b on a.house_id = b.house_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

revoke all on function public.is_house_member(uuid), public.is_house_admin(uuid),
  public.shares_house_with(uuid) from public, anon;
grant execute on function public.is_house_member(uuid), public.is_house_admin(uuid),
  public.shares_house_with(uuid) to authenticated, service_role;

-- ───────── הרשאות טבלה (anon לא ניגש לכלום) ─────────
revoke all on public.profiles, public.houses, public.house_members, public.shopping_items,
  public.car_reservations, public.announcements, public.issues from anon;
grant select, insert, update, delete on public.profiles, public.houses, public.house_members,
  public.shopping_items, public.car_reservations, public.announcements, public.issues
  to authenticated;

alter table public.profiles         enable row level security;
alter table public.houses           enable row level security;
alter table public.house_members    enable row level security;
alter table public.shopping_items   enable row level security;
alter table public.car_reservations enable row level security;
alter table public.announcements    enable row level security;
alter table public.issues           enable row level security;

-- ───────── profiles ─────────
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_house_with(id));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (current_house_id is null or public.is_house_member(current_house_id))
  );
-- אין insert/delete ישיר: הפרופיל נוצר בטריגר ונמחק עם המשתמש.

-- ───────── houses ─────────
-- יצירה והצטרפות — רק דרך RPC (create_house / join_house).
create policy houses_select on public.houses for select to authenticated
  using (public.is_house_member(id));
create policy houses_update on public.houses for update to authenticated
  using (public.is_house_admin(id)) with check (public.is_house_admin(id));
create policy houses_delete on public.houses for delete to authenticated
  using (public.is_house_admin(id));

-- ───────── house_members ─────────
create policy house_members_select on public.house_members for select to authenticated
  using (public.is_house_member(house_id));
-- שינוי תפקיד: מנהל בלבד
create policy house_members_update on public.house_members for update to authenticated
  using (public.is_house_admin(house_id)) with check (public.is_house_admin(house_id));
-- עזיבה (שורה עצמית) או הסרה ע"י מנהל
create policy house_members_delete on public.house_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_house_admin(house_id));

-- ───────── טבלאות הדומיין ─────────
-- קריאה/יצירה לחברי הבית; עדכון/מחיקה ליוצר או למנהל.
-- הערות: ברשימת קניות כל חבר יכול לעדכן (סימון "נקנה"); בתקלות גם האחראי המשויך יכול לעדכן.
do $$
declare
  t record;
  upd_extra text;
begin
  for t in
    select * from (values
      ('shopping_items',   'added_by'),
      ('car_reservations', 'user_id'),
      ('announcements',    'created_by'),
      ('issues',           'created_by')
    ) as v(tbl, creator)
  loop
    execute format($f$create policy %1$s_select on public.%1$s for select to authenticated
      using (public.is_house_member(house_id))$f$, t.tbl);

    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (public.is_house_member(house_id) and %2$I = (select auth.uid()))$f$, t.tbl, t.creator);

    upd_extra := case t.tbl
      when 'shopping_items' then 'public.is_house_member(house_id)'
      when 'issues' then format('%I = (select auth.uid()) or assignee_id = (select auth.uid())', t.creator)
      else format('%I = (select auth.uid())', t.creator)
    end;

    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using (public.is_house_admin(house_id) or %2$s)
      with check (public.is_house_member(house_id)
                  and (public.is_house_admin(house_id) or %2$s))$f$, t.tbl, upd_extra);

    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (public.is_house_admin(house_id) or %2$I = (select auth.uid()))$f$, t.tbl, t.creator);
  end loop;
end $$;
