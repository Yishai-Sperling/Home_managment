-- 0006_push_tokens.sql — מזהי מכשיר להתראות Push (Expo Push Token).
-- כל משתמש מנהל רק את המכשירים של עצמו; הפונקציה notify-house קוראת עם service role.

create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null default 'android',
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy push_tokens_select_own on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_insert_own on public.push_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_tokens_update_own on public.push_tokens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
