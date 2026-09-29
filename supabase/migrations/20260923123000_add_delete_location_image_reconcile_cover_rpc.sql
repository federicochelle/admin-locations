create or replace function public.delete_location_image_and_reconcile_cover(
  p_location_id uuid,
  p_image_id uuid
)
returns table (
  deleted_image_id uuid,
  promoted_image_id uuid,
  cover_image_id uuid,
  reconciled_cover boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_cover_image_id uuid;
  v_image_is_cover boolean;
  v_image_location_id uuid;
  v_next_cover_image_id uuid;
  v_reconciled_cover boolean := false;
begin
  select l.cover_image_id
  into v_current_cover_image_id
  from public.locations l
  where l.id = p_location_id
  for update;

  if not found then
    raise exception 'Location % does not exist.', p_location_id
      using errcode = '23503';
  end if;

  select
    li.location_id,
    coalesce(li.is_cover, false)
  into
    v_image_location_id,
    v_image_is_cover
  from public.location_images li
  where li.id = p_image_id
  for update;

  if not found then
    raise exception 'Image % does not exist.', p_image_id
      using errcode = 'P0002';
  end if;

  if v_image_location_id <> p_location_id then
    raise exception 'Image % does not belong to location %.', p_image_id, p_location_id
      using errcode = '23503';
  end if;

  v_reconciled_cover := v_image_is_cover = true or v_current_cover_image_id = p_image_id;

  delete from public.location_images li
  where li.id = p_image_id
    and li.location_id = p_location_id;

  if v_reconciled_cover then
    select li.id
    into v_next_cover_image_id
    from public.location_images li
    where li.location_id = p_location_id
    order by
      li.sort_order asc nulls last,
      li.created_at asc,
      li.id asc
    limit 1;

    if v_next_cover_image_id is null then
      update public.locations l
      set cover_image_id = null
      where l.id = p_location_id;
    else
      update public.location_images li
      set is_cover = li.id = v_next_cover_image_id
      where li.location_id = p_location_id;

      update public.locations l
      set cover_image_id = v_next_cover_image_id
      where l.id = p_location_id;
    end if;
  else
    v_next_cover_image_id := null;
  end if;

  return query
  select
    p_image_id,
    v_next_cover_image_id,
    case
      when v_reconciled_cover then v_next_cover_image_id
      else v_current_cover_image_id
    end,
    v_reconciled_cover;
end;
$$;

revoke all on function public.delete_location_image_and_reconcile_cover(uuid, uuid) from public;
grant execute on function public.delete_location_image_and_reconcile_cover(uuid, uuid) to service_role;
