create or replace function public.update_category_location_display_order(
  p_category_id uuid,
  p_location_ids uuid[]
)
returns table (
  location_id uuid,
  display_order integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_input_count integer;
  v_distinct_input_count integer;
  v_matching_count integer;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden actualizar el orden de locaciones.'
      using errcode = '42501';
  end if;

  if p_category_id is null then
    raise exception 'La categoria es obligatoria.'
      using errcode = '23502';
  end if;

  if p_location_ids is null then
    raise exception 'El orden de locaciones es obligatorio.'
      using errcode = '23502';
  end if;

  select count(*)
  into v_expected_count
  from public.locations l
  where l.category_id = p_category_id;

  select
    count(*),
    count(distinct location_id)
  into
    v_input_count,
    v_distinct_input_count
  from unnest(p_location_ids) as input(location_id);

  if v_input_count <> v_distinct_input_count then
    raise exception 'El orden de locaciones contiene IDs duplicados.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from unnest(p_location_ids) as input(location_id)
    where input.location_id is null
  ) then
    raise exception 'El orden de locaciones contiene IDs invalidos.'
      using errcode = '23502';
  end if;

  if v_input_count <> v_expected_count then
    raise exception 'El orden debe incluir todas las locaciones de la categoria.'
      using errcode = '2202E';
  end if;

  select count(*)
  into v_matching_count
  from public.locations l
  join unnest(p_location_ids) as input(location_id)
    on input.location_id = l.id
  where l.category_id = p_category_id;

  if v_matching_count <> v_expected_count then
    raise exception 'Todas las locaciones del orden deben pertenecer a la categoria indicada.'
      using errcode = '23503';
  end if;

  return query
  with ordered_locations as (
    select
      input.location_id,
      input.ordinality::integer as next_display_order
    from unnest(p_location_ids) with ordinality as input(location_id, ordinality)
  )
  update public.locations as locations
  set display_order = ordered_locations.next_display_order
  from ordered_locations
  where locations.id = ordered_locations.location_id
    and locations.category_id = p_category_id
  returning
    locations.id,
    locations.display_order;
end;
$$;

revoke all on function public.update_category_location_display_order(uuid, uuid[]) from public;
grant execute on function public.update_category_location_display_order(uuid, uuid[]) to authenticated;
