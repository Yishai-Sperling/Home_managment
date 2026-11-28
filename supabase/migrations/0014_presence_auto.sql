-- 0014: סימון עדכוני נוכחות שהגיעו מגדר-גיאוגרפי אוטומטי (presence_auto), כדי שהלקוח לא יפקיע אותם.
-- בטוח להרצה חוזרת. אין צורך בעריכה.

alter table public.house_members
  add column if not exists presence_auto boolean not null default false;

-- שינוי חתימה יוצר overload ב-Postgres, לכן מסירים קודם את הפונקציה הישנה (3 ארגומנטים).
do $$
begin
  if to_regprocedure('public.set_presence(uuid,text,timestamptz)') is not null then
    drop function public.set_presence(uuid, text, timestamptz);
  end if;
end $$;

create or replace function public.set_presence(
  p_house uuid,
  p_status text,
  p_eta timestamptz default null,
  p_auto boolean default false
)
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
       set presence = null, presence_eta = null, presence_updated_at = null, presence_auto = false
     where house_id = p_house and user_id = v_uid;
  else
    update public.house_members
       set presence = p_status,
           presence_eta = case when p_status = 'soon' then p_eta else null end,
           presence_updated_at = now(),
           presence_auto = coalesce(p_auto, false)
     where house_id = p_house and user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.set_presence(uuid, text, timestamptz, boolean) from public, anon;
grant execute on function public.set_presence(uuid, text, timestamptz, boolean) to authenticated, service_role;
