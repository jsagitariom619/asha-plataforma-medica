-- Estado operativo compartido de ASHA.
-- El navegador nunca accede directamente a esta fila: la API del servidor
-- valida el usuario y filtra/combina cada sección según sus permisos.

create table if not exists public.clinic_state (
  id text primary key check (id = 'asha'),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.clinic_state enable row level security;

drop policy if exists clinic_state_select_active_user on public.clinic_state;
drop policy if exists clinic_state_insert_active_user on public.clinic_state;
drop policy if exists clinic_state_update_active_user on public.clinic_state;
drop policy if exists clinic_state_no_direct_client_access on public.clinic_state;

create policy clinic_state_no_direct_client_access
on public.clinic_state
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.clinic_state from anon, authenticated;
grant all on public.clinic_state to service_role;

create index if not exists idx_clinic_state_updated_by
  on public.clinic_state(updated_by);

comment on table public.clinic_state is
  'Estado operativo compartido de ASHA, accesible exclusivamente desde rutas seguras del servidor.';
