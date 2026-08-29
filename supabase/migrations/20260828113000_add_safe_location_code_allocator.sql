create or replace function public.normalize_location_code_prefix(
  p_category_name text
)
returns text
language plpgsql
as $$
declare
  v_category_name text;
  v_normalized_name text;
begin
  v_category_name := btrim(coalesce(p_category_name, ''));

  if lower(v_category_name) = 'locales de ropa' then
    v_category_name := 'Local de ropa';
  end if;

  v_normalized_name := upper(
    regexp_replace(
      trim(
        both '-'
        from regexp_replace(
          translate(
            v_category_name,
            'áàäâãéèëêẽíìïîĩóòöôõúùüûũñÁÀÄÂÃÉÈËÊẼÍÌÏÎĨÓÒÖÔÕÚÙÜÛŨÑ',
            'aaaaaeeeeeiiiiiooooouuuuunaAAAAAEEEEEIIIIIOOOOOUUUUUN'
          ),
          '[^[:alnum:]]+',
          '-',
          'g'
        )
      ),
      '(^-+|-+$)',
      '',
      'g'
    )
  );

  if v_normalized_name = '' then
    return 'CATEGORIA';
  end if;

  return case v_normalized_name
    when 'ALMACENES' then 'ALMACEN'
    when 'ESTANCIAS' then 'ESTANCIA'
    when 'CASAS' then 'CASA'
    when 'CALLES' then 'CALLE'
    when 'APARTAMENTOS' then 'APARTAMENTO'
    when 'PEATONALES' then 'PEATONAL'
    when 'PISCINAS' then 'PISCINA'
    when 'PLAZAS' then 'PLAZA'
    when 'PARQUES' then 'PARQUE'
    when 'CAFETERIAS' then 'CAFETERIA'
    when 'CANCHAS-DE-FUTBOL' then 'CANCHA DE FUTBOL'
    when 'BARES' then 'BAR'
    when 'MUSEOS' then 'MUSEO'
    when 'OFICINAS' then 'OFICINA'
    when 'RESTAURANTES' then 'RESTAURANTE'
    when 'ESTADIOS' then 'ESTADIO'
    when 'CANCHAS-DE-BASQUET' then 'CANCHA DE BASQUET'
    when 'GIMNASIOS' then 'GIMNASIO'
    when 'EDIFICIOS' then 'EDIFICIO'
    when 'GALPONES' then 'GALPON'
    else v_normalized_name
  end;
end;
$$;

create or replace function public.get_location_code_prefix(
  p_category_id uuid
)
returns text
language plpgsql
as $$
declare
  v_category_name text;
  v_stored_prefix text;
begin
  if p_category_id is null then
    return null;
  end if;

  select
    name,
    upper(regexp_replace(btrim(coalesce(location_code_prefix, '')), '\s+', ' ', 'g'))
  into
    v_category_name,
    v_stored_prefix
  from public.categories
  where id = p_category_id;

  if not found then
    raise exception 'Category % does not exist.', p_category_id
      using errcode = '23503';
  end if;

  if v_stored_prefix is not null and v_stored_prefix <> '' then
    return v_stored_prefix;
  end if;

  return public.normalize_location_code_prefix(v_category_name);
end;
$$;

create or replace function public.allocate_location_code(
  p_category_id uuid
)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_next_sequence bigint;
begin
  if p_category_id is null then
    return null;
  end if;

  v_prefix := public.get_location_code_prefix(p_category_id);

  if v_prefix is null or v_prefix = '' then
    raise exception 'Could not resolve location_code prefix for category %.', p_category_id
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));

  with existing_sequences as (
    select distinct
      substring(location_code from char_length(v_prefix) + 2)::bigint as sequence_number
    from public.locations
    where left(location_code, char_length(v_prefix) + 1) = v_prefix || '-'
      and substring(location_code from char_length(v_prefix) + 2) ~ '^[0-9]+$'
  ),
  sequence_bounds as (
    select coalesce(max(sequence_number), 0) as max_sequence
    from existing_sequences
  ),
  next_gap as (
    select candidate.sequence_number
    from generate_series(
      1,
      (select max_sequence + 1 from sequence_bounds)
    ) as candidate(sequence_number)
    left join existing_sequences
      on existing_sequences.sequence_number = candidate.sequence_number
    where existing_sequences.sequence_number is null
    order by candidate.sequence_number
    limit 1
  )
  select sequence_number
  into v_next_sequence
  from next_gap;

  if v_next_sequence is null then
    v_next_sequence := 1;
  end if;

  return v_prefix || '-' || case
    when v_next_sequence < 1000 then lpad(v_next_sequence::text, 3, '0')
    else v_next_sequence::text
  end;
end;
$$;

create or replace function public.assign_location_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.location_code is null and new.category_id is not null then
      new.location_code := public.allocate_location_code(new.category_id);
    end if;

    return new;
  end if;

  if new.category_id is distinct from old.category_id then
    if new.location_code is null or new.location_code = old.location_code then
      if new.category_id is null then
        new.location_code := null;
      else
        new.location_code := public.allocate_location_code(new.category_id);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_location_code on public.locations;

create trigger trg_assign_location_code
before insert or update of category_id
on public.locations
for each row
execute function public.assign_location_code();
