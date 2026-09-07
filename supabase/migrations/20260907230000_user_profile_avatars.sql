-- Foto de perfil opcional por usuario ASHA.
-- Conserva usuarios, credenciales, roles, permisos y sesiones existentes.

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on column public.profiles.avatar_url is
  'URL de la fotografía opcional del usuario almacenada en Supabase Storage.';
