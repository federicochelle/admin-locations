create or replace function public.normalize_location_code_prefix_value(
  p_prefix text
)
returns text
language plpgsql
as $$
declare
  v_prefix text;
begin
  v_prefix := upper(
    regexp_replace(
      trim(
        both '-'
        from regexp_replace(
          translate(
            btrim(coalesce(p_prefix, '')),
            'áàäâãéèëêẽíìïîĩóòöôõúùüûũñçÁÀÄÂÃÉÈËÊẼÍÌÏÎĨÓÒÖÔÕÚÙÜÛŨÑÇ',
            'aaaaaeeeeeiiiiiooooouuuuuncAAAAAEEEEEIIIIIOOOOOUUUUUNC'
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

  if v_prefix = '' then
    return null;
  end if;

  return v_prefix;
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
    public.normalize_location_code_prefix_value(location_code_prefix)
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

do $$
declare
  v_collision record;
begin
  select
    normalized_prefix,
    total
  into v_collision
  from (
    select
      public.normalize_location_code_prefix_value(location_code_prefix) as normalized_prefix,
      count(*) as total
    from public.categories
    where public.normalize_location_code_prefix_value(location_code_prefix) in (
      'FABRICA',
      'GALPON',
      'PELUQUERIA'
    )
    group by public.normalize_location_code_prefix_value(location_code_prefix)
    having count(*) > 1
  ) collisions
  limit 1;

  if found then
    raise exception
      'Cannot normalize location_code_prefix because normalized prefix % would collide across % categories.',
      v_collision.normalized_prefix,
      v_collision.total
      using errcode = '23505';
  end if;
end;
$$;

update public.categories
set location_code_prefix = case location_code_prefix
  when 'FÁBRICA' then 'FABRICA'
  when 'GALPÓN' then 'GALPON'
  when 'PELUQUERÍA' then 'PELUQUERIA'
  else location_code_prefix
end
where location_code_prefix in ('FÁBRICA', 'GALPÓN', 'PELUQUERÍA');
