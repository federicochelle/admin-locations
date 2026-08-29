create or replace function public.admin_set_profile_production_company(
  p_profile_id uuid,
  p_production_company_id uuid default null
)
returns table (
  profile_id uuid,
  production_company_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden actualizar la productora asociada del perfil.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
  ) then
    raise exception 'No existe el perfil indicado.'
      using errcode = 'P0002';
  end if;

  if p_production_company_id is not null and not exists (
    select 1
    from public.production_companies
    where id = p_production_company_id
  ) then
    raise exception 'No existe la productora indicada.'
      using errcode = '23503';
  end if;

  return query
  update public.profiles
  set production_company_id = p_production_company_id
  where id = p_profile_id
  returning
    public.profiles.id,
    public.profiles.production_company_id;
end;
$$;

revoke all on function public.admin_set_profile_production_company(uuid, uuid) from public;
grant execute on function public.admin_set_profile_production_company(uuid, uuid) to authenticated;
