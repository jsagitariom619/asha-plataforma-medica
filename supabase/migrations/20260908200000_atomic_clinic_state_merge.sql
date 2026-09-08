-- Evita pérdida de actualizaciones cuando dos sesiones guardan simultáneamente.
-- Solo las rutas server-side con credencial administrativa pueden ejecutar esta función.

create or replace function public.merge_clinic_state(
  p_patch jsonb,
  p_updated_by uuid
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'p_patch must be a JSON object';
  end if;

  return query
  with upserted as (
    insert into public.clinic_state as cs (
      id, payload, revision, updated_by, updated_at
    )
    values (
      'asha', p_patch, 1, p_updated_by, now()
    )
    on conflict (id) do update
    set payload = cs.payload || excluded.payload,
        revision = cs.revision + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
    returning cs.revision as r, cs.updated_at as u
  )
  select upserted.r, upserted.u from upserted;
end;
$$;

revoke all on function public.merge_clinic_state(jsonb, uuid) from public;
revoke all on function public.merge_clinic_state(jsonb, uuid) from anon;
revoke all on function public.merge_clinic_state(jsonb, uuid) from authenticated;
grant execute on function public.merge_clinic_state(jsonb, uuid) to service_role;
