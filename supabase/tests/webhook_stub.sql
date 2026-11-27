-- מחליף את supabase_functions.http_request בגרסת בדיקה שרושמת קריאות לטבלה (להרצה אחרי supabase_shim.sql, לפני 0005).
create schema if not exists supabase_functions;
create table supabase_functions.calls (
  id bigserial primary key, tbl text, op text, args text[], new_presence text, old_presence text
);
create function supabase_functions.http_request() returns trigger language plpgsql security definer as $$
declare n jsonb; o jsonb;
begin
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  insert into supabase_functions.calls (tbl, op, args, new_presence, old_presence)
  values (tg_table_name, tg_op, tg_argv, n ->> 'presence', o ->> 'presence');
  return null;
end $$;
