create or replace function public.apply_location_category_order(
  p_category_id uuid,
  p_location_ids uuid[],
  p_prefix text default null
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
  v_input_count integer;
  v_distinct_input_count integer;
  v_matching_count integer;
  v_prefix text;
begin
  if p_location_ids is null then
    raise exception 'El orden de locaciones es obligatorio.'
      using errcode = '23502';
  end if;

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

  select count(*)
  into v_matching_count
  from public.locations l
  join unnest(p_location_ids) as input_locations(location_id)
    on input_locations.location_id = l.id
  where l.category_id is not distinct from p_category_id;

  if v_matching_count <> v_input_count then
    raise exception 'Todas las locaciones del orden deben pertenecer a la categoria indicada.'
      using errcode = '23503';
  end if;

  if p_category_id is null then
    return query
    with ordered_locations as (
      select
        input_locations.location_id,
        input_locations.ordinality::integer as next_display_order
      from unnest(p_location_ids) with ordinality as input_locations(location_id, ordinality)
    )
    update public.locations as locations
    set display_order = ordered_locations.next_display_order
    from ordered_locations
    where locations.id = ordered_locations.location_id
      and locations.category_id is not distinct from p_category_id
    returning
      locations.id as location_id,
      locations.display_order as display_order;

    return;
  end if;

  v_prefix := coalesce(p_prefix, public.get_location_code_prefix(p_category_id));

  if v_prefix is null or v_prefix = '' then
    raise exception 'Could not resolve location_code prefix for category %.', p_category_id
      using errcode = '22023';
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

revoke all on function public.apply_location_category_order(uuid, uuid[], text) from public;
revoke all on function public.apply_location_category_order(uuid, uuid[], text) from anon;
revoke all on function public.apply_location_category_order(uuid, uuid[], text) from authenticated;

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

  return query
  select *
  from public.apply_location_category_order(p_category_id, p_location_ids, v_prefix);
end;
$$;

revoke all on function public.update_category_location_display_order(uuid, uuid[]) from public;
grant execute on function public.update_category_location_display_order(uuid, uuid[]) to authenticated;

create or replace function public.move_location_to_category(
  p_location_id uuid,
  p_category_id uuid
)
returns table (
  location_id uuid,
  category_id uuid,
  display_order integer,
  location_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_category_id uuid;
  v_locked_old_category_id uuid;
  v_new_category_id uuid;
  v_old_prefix text;
  v_new_prefix text;
  v_lock_key bigint;
  v_old_location_ids uuid[];
  v_new_location_ids uuid[];
  v_null_location_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden cambiar la categoria de una locacion.'
      using errcode = '42501';
  end if;

  if p_location_id is null then
    raise exception 'La locacion es obligatoria.'
      using errcode = '23502';
  end if;

  select l.category_id
  into v_old_category_id
  from public.locations l
  where l.id = p_location_id;

  if not found then
    raise exception 'La locacion indicada no existe.'
      using errcode = '23503';
  end if;

  v_new_category_id := p_category_id;

  if v_new_category_id is not null then
    perform 1
    from public.categories c
    where c.id = v_new_category_id;

    if not found then
      raise exception 'Category % does not exist.', v_new_category_id
        using errcode = '23503';
    end if;
  end if;

  if v_old_category_id is not distinct from v_new_category_id then
    return query
    select
      l.id as location_id,
      l.category_id,
      l.display_order,
      l.location_code
    from public.locations l
    where l.id = p_location_id;

    return;
  end if;

  if v_old_category_id is not null then
    v_old_prefix := public.get_location_code_prefix(v_old_category_id);
  end if;

  if v_new_category_id is not null then
    v_new_prefix := public.get_location_code_prefix(v_new_category_id);
  end if;

  for v_lock_key in
    select distinct lock_key
    from (
      values
        (case when v_old_prefix is null or v_old_prefix = '' then null else hashtextextended(v_old_prefix, 0) end),
        (case when v_new_prefix is null or v_new_prefix = '' then null else hashtextextended(v_new_prefix, 0) end)
    ) as lock_keys(lock_key)
    where lock_key is not null
    order by lock_key
  loop
    perform pg_advisory_xact_lock(v_lock_key);
  end loop;

  select l.category_id
  into v_locked_old_category_id
  from public.locations l
  where l.id = p_location_id
  for update;

  if not found then
    raise exception 'La locacion indicada no existe.'
      using errcode = '23503';
  end if;

  if v_locked_old_category_id is distinct from v_old_category_id then
    raise exception 'La categoria de la locacion cambio concurrentemente. Intentá guardar nuevamente.'
      using errcode = '40001';
  end if;

  perform l.id
  from public.locations l
  where l.category_id is not distinct from v_old_category_id
     or l.category_id is not distinct from v_new_category_id
  order by l.category_id nulls first, l.id
  for update;

  update public.locations as locations
  set
    category_id = v_new_category_id,
    location_code = null
  where locations.id = p_location_id;

  if v_old_category_id is not null then
    select coalesce(array_agg(l.id order by l.display_order asc, l.id asc), array[]::uuid[])
    into v_old_location_ids
    from public.locations l
    where l.category_id = v_old_category_id;

    perform *
    from public.apply_location_category_order(v_old_category_id, v_old_location_ids, v_old_prefix);
  else
    select coalesce(array_agg(l.id order by l.display_order asc, l.id asc), array[]::uuid[])
    into v_null_location_ids
    from public.locations l
    where l.category_id is null;

    perform *
    from public.apply_location_category_order(null, v_null_location_ids, null);
  end if;

  if v_new_category_id is not null then
    select coalesce(array_agg(ordered_locations.id order by ordered_locations.sort_group, ordered_locations.display_order asc, ordered_locations.id asc), array[]::uuid[])
    into v_new_location_ids
    from (
      select
        l.id,
        l.display_order,
        case when l.id = p_location_id then 1 else 0 end as sort_group
      from public.locations l
      where l.category_id = v_new_category_id
    ) ordered_locations;

    perform *
    from public.apply_location_category_order(v_new_category_id, v_new_location_ids, v_new_prefix);
  else
    select coalesce(array_agg(ordered_locations.id order by ordered_locations.sort_group, ordered_locations.display_order asc, ordered_locations.id asc), array[]::uuid[])
    into v_null_location_ids
    from (
      select
        l.id,
        l.display_order,
        case when l.id = p_location_id then 1 else 0 end as sort_group
      from public.locations l
      where l.category_id is null
    ) ordered_locations;

    perform *
    from public.apply_location_category_order(null, v_null_location_ids, null);
  end if;

  return query
  select
    l.id as location_id,
    l.category_id,
    l.display_order,
    l.location_code
  from public.locations l
  where l.id = p_location_id;
end;
$$;

revoke all on function public.move_location_to_category(uuid, uuid) from public;
grant execute on function public.move_location_to_category(uuid, uuid) to authenticated;
