-- 0004_storage.sql — דלי פרטי לתמונות תקלות. נתיב אובייקט: <house_id>/<uuid>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-images', 'issue-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

-- מחלץ את house_id מהתיקייה הראשונה בנתיב; null אם אינו UUID תקין
create or replace function public.storage_house_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
grant execute on function public.storage_house_id(text) to authenticated, service_role;

create policy issue_images_select on storage.objects for select to authenticated
  using (bucket_id = 'issue-images' and public.is_house_member(public.storage_house_id(name)));

create policy issue_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-images' and public.is_house_member(public.storage_house_id(name)));

create policy issue_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and (owner = (select auth.uid()) or public.is_house_admin(public.storage_house_id(name)))
  );
