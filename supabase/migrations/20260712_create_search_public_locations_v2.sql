create or replace function public.search_public_locations_v2(
  p_query text default null,
  p_category_slug text default null,
  p_feature_slugs text[] default '{}',
  p_tag_slugs text[] default '{}',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  location_code text,
  category_name text,
  department_name text,
  zone_name text,
  cover_image_url text,
  cover_image_alt text,
  features text[],
  matched_feature_count integer,
  selected_feature_count integer,
  matched_tag_count integer,
  selected_tag_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with base_locations as (
    select
      l.id,
      l.slug as internal_slug,
      l.location_code,
      l.description,
      c.name as category_name,
      c.slug as category_slug,
      d.name as department_name,
      z.name as zone_name
    from public.locations l
    left join public.categories c
      on c.id = l.category_id
    left join public.departments d
      on d.id = l.department_id
    left join public.zones z
      on z.id = l.zone_id
    where l.published = true
      and (
        nullif(trim(p_category_slug), '') is null
        or lower(coalesce(c.slug, '')) = lower(trim(p_category_slug))
      )
  ),
  feature_agg as (
    select
      lf.location_id,
      coalesce(
        array_agg(distinct f.name order by f.name)
          filter (where f.name is not null),
        '{}'::text[]
      ) as features,
      coalesce(
        array_agg(distinct f.slug order by f.slug)
          filter (where f.slug is not null),
        '{}'::text[]
      ) as feature_slugs,
      trim(
        coalesce(
          string_agg(distinct f.name, ' ' order by f.name)
            filter (where f.name is not null),
          ''
        ) || ' ' ||
        coalesce(
          string_agg(distinct f.slug, ' ' order by f.slug)
            filter (where f.slug is not null),
          ''
        )
      ) as feature_search_text
    from public.location_features lf
    join public.features f
      on f.id = lf.feature_id
    group by lf.location_id
  ),
  tag_agg as (
    select
      lt.location_id,
      coalesce(
        array_agg(distinct t.slug order by t.slug)
          filter (where t.slug is not null),
        '{}'::text[]
      ) as tag_slugs,
      trim(
        coalesce(
          string_agg(distinct t.name, ' ' order by t.name)
            filter (where t.name is not null),
          ''
        ) || ' ' ||
        coalesce(
          string_agg(distinct t.slug, ' ' order by t.slug)
            filter (where t.slug is not null),
          ''
        )
      ) as tag_search_text
    from public.location_tags lt
    join public.tags t
      on t.id = lt.tag_id
    group by lt.location_id
  ),
  image_agg as (
    select distinct on (li.location_id)
      li.location_id,
      li.url as cover_image_url,
      coalesce(li.alt_text, 'Imagen de locacion') as cover_image_alt
    from public.location_images li
    where li.url is not null
    order by
      li.location_id,
      case when li.is_cover = true then 0 else 1 end,
      coalesce(li.sort_order, 2147483647),
      li.url
  ),
  search_source as (
    select
      bl.id,
      coalesce(lower(trim(bl.location_code)), bl.internal_slug, bl.id::text) as slug,
      bl.location_code,
      coalesce(bl.category_name, 'Sin categoria') as category_name,
      coalesce(bl.department_name, 'Sin departamento') as department_name,
      coalesce(bl.zone_name, 'Sin zona') as zone_name,
      ia.cover_image_url,
      coalesce(ia.cover_image_alt, 'Imagen de locacion') as cover_image_alt,
      coalesce(fa.features, '{}'::text[]) as features,
      coalesce(fa.feature_slugs, '{}'::text[]) as feature_slugs,
      coalesce(ta.tag_slugs, '{}'::text[]) as tag_slugs,
      (
        select count(distinct selected_slug)::integer
        from unnest(coalesce(p_feature_slugs, '{}'::text[])) as selected_feature(selected_slug)
        where selected_slug <> ''
          and selected_slug = any(coalesce(fa.feature_slugs, '{}'::text[]))
      ) as matched_feature_count,
      (
        select count(distinct selected_slug)::integer
        from unnest(coalesce(p_feature_slugs, '{}'::text[])) as selected_feature(selected_slug)
        where selected_slug <> ''
      ) as selected_feature_count,
      (
        select count(distinct selected_slug)::integer
        from unnest(coalesce(p_tag_slugs, '{}'::text[])) as selected_tag(selected_slug)
        where selected_slug <> ''
          and selected_slug = any(coalesce(ta.tag_slugs, '{}'::text[]))
      ) as matched_tag_count,
      (
        select count(distinct selected_slug)::integer
        from unnest(coalesce(p_tag_slugs, '{}'::text[])) as selected_tag(selected_slug)
        where selected_slug <> ''
      ) as selected_tag_count,
      lower(
        trim(
          concat_ws(
            ' ',
            bl.location_code,
            bl.description,
            bl.category_name,
            bl.category_slug,
            bl.department_name,
            bl.zone_name,
            fa.feature_search_text,
            ta.tag_search_text
          )
        )
      ) as search_text
    from base_locations bl
    left join feature_agg fa
      on fa.location_id = bl.id
    left join tag_agg ta
      on ta.location_id = bl.id
    left join image_agg ia
      on ia.location_id = bl.id
  ),
  final as (
    select
      ss.id,
      ss.slug,
      ss.location_code,
      ss.category_name,
      ss.department_name,
      ss.zone_name,
      ss.cover_image_url,
      ss.cover_image_alt,
      ss.features,
      ss.matched_feature_count,
      ss.selected_feature_count,
      ss.matched_tag_count,
      ss.selected_tag_count
    from search_source ss
    where
      (
        ss.selected_feature_count = 0
        or ss.matched_feature_count = ss.selected_feature_count
      )
      and (
        ss.selected_tag_count = 0
        or ss.matched_tag_count = ss.selected_tag_count
      )
      and (
        nullif(trim(p_query), '') is null
        or not exists (
          select 1
          from regexp_split_to_table(lower(trim(p_query)), '\s+') as query_tokens(query_token)
          where query_token <> ''
            and ss.search_text not like '%' || query_token || '%'
        )
      )
  )
  select
    final.id,
    final.slug,
    final.location_code,
    final.category_name,
    final.department_name,
    final.zone_name,
    final.cover_image_url,
    final.cover_image_alt,
    final.features,
    final.matched_feature_count,
    final.selected_feature_count,
    final.matched_tag_count,
    final.selected_tag_count
  from final
  order by final.location_code asc nulls last, final.id asc
  limit greatest(coalesce(p_limit, 24), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_public_locations_v2(
  text,
  text,
  text[],
  text[],
  integer,
  integer
) to anon, authenticated;
