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
  v_prefix text;
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

  v_prefix := public.get_location_code_prefix(p_category_id);

  if v_prefix is null or v_prefix = '' then
    raise exception 'Could not resolve location_code prefix for category %.', p_category_id
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));

  perform l.id
  from public.locations l
  where l.category_id = p_category_id
  order by l.id
  for update;

  select count(*)
  into v_expected_count
  from public.locations l
  where l.category_id = p_category_id;

  select
    count(*),
    count(distinct input_locations.location_id)
  into
    v_input_count,
    v_distinct_input_count
  from unnest(p_location_ids) as input_locations(location_id);

  if v_input_count <> v_distinct_input_count then
    raise exception 'El orden de locaciones contiene IDs duplicados.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from unnest(p_location_ids) as input_locations(location_id)
    where input_locations.location_id is null
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
  join unnest(p_location_ids) as input_locations(location_id)
    on input_locations.location_id = l.id
  where l.category_id = p_category_id;

  if v_matching_count <> v_expected_count then
    raise exception 'Todas las locaciones del orden deben pertenecer a la categoria indicada.'
      using errcode = '23503';
  end if;

  with ordered_locations as (
    select input_locations.location_id
    from unnest(p_location_ids) as input_locations(location_id)
  )
  update public.locations as locations
  set location_code = '__REORDER__:' || txid_current()::text || ':' || locations.id::text
  from ordered_locations
  where locations.id = ordered_locations.location_id
    and locations.category_id = p_category_id;

  return query
  with ordered_locations as (
    select
      input_locations.location_id,
      input_locations.ordinality::integer as next_display_order,
      v_prefix || '-' || case
        when input_locations.ordinality < 1000 then lpad(input_locations.ordinality::text, 3, '0')
        else input_locations.ordinality::text
      end as next_location_code
    from unnest(p_location_ids) with ordinality as input_locations(location_id, ordinality)
  )
  update public.locations as locations
  set
    display_order = ordered_locations.next_display_order,
    location_code = ordered_locations.next_location_code
  from ordered_locations
  where locations.id = ordered_locations.location_id
    and locations.category_id = p_category_id
  returning
    locations.id as location_id,
    locations.display_order as display_order;
end;
$$;

revoke all on function public.update_category_location_display_order(uuid, uuid[]) from public;
grant execute on function public.update_category_location_display_order(uuid, uuid[]) to authenticated;
