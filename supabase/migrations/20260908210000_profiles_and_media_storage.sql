alter table public.profiles
  add column if not exists contact_email text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('clinical-images', 'clinical-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reads and writes pass only through authenticated ASHA server routes. No
-- client Storage policies are created; the service key stays server-side.

alter function public.set_updated_at() set search_path = public, pg_temp;
