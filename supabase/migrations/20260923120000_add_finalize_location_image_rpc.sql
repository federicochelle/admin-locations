create or replace function public.finalize_location_image(
  p_location_id uuid,
  p_client_upload_id uuid,
  p_url text,
  p_storage_key text,
  p_alt_text text,
  p_caption text,
  p_sort_order integer,
  p_is_cover boolean,
  p_width integer,
  p_height integer
)
returns table (
  id uuid,
  location_id uuid,
  client_upload_id uuid,
  url text,
  storage_key text,
  alt_text text,
  caption text,
  sort_order integer,
  is_cover boolean,
  width integer,
  height integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_upload_id is not null then
    return query
    select
      li.id,
      li.location_id,
      li.client_upload_id,
      li.url,
      li.storage_key,
      li.alt_text,
      li.caption,
      li.sort_order,
      li.is_cover,
      li.width,
      li.height,
      li.created_at,
      li.updated_at
    from public.location_images li
    where li.location_id = p_location_id
      and li.client_upload_id = p_client_upload_id
    limit 1;

    if found then
      return;
    end if;
  end if;

  if not exists (
    select 1
    from public.locations l
    where l.id = p_location_id
  ) then
    raise exception 'Location % does not exist.', p_location_id
      using errcode = '23503';
  end if;

  begin
    if p_is_cover = true then
      perform 1
      from public.locations l
      where l.id = p_location_id
      for update;

      update public.location_images li
      set is_cover = false
      where li.location_id = p_location_id
        and li.is_cover = true;
    end if;

    return query
    with created_image as (
      insert into public.location_images (
        alt_text,
        caption,
        client_upload_id,
        height,
        is_cover,
        location_id,
        sort_order,
        storage_key,
        url,
        width
      )
      values (
        p_alt_text,
        p_caption,
        p_client_upload_id,
        p_height,
        p_is_cover,
        p_location_id,
        p_sort_order,
        p_storage_key,
        p_url,
        p_width
      )
      returning
        public.location_images.id,
        public.location_images.location_id,
        public.location_images.client_upload_id,
        public.location_images.url,
        public.location_images.storage_key,
        public.location_images.alt_text,
        public.location_images.caption,
        public.location_images.sort_order,
        public.location_images.is_cover,
        public.location_images.width,
        public.location_images.height,
        public.location_images.created_at,
        public.location_images.updated_at
    ),
    synced_location as (
      update public.locations l
      set cover_image_id = created_image.id
      from created_image
      where p_is_cover = true
        and l.id = created_image.location_id
      returning 1
    )
    select
      created_image.id,
      created_image.location_id,
      created_image.client_upload_id,
      created_image.url,
      created_image.storage_key,
      created_image.alt_text,
      created_image.caption,
      created_image.sort_order,
      created_image.is_cover,
      created_image.width,
      created_image.height,
      created_image.created_at,
      created_image.updated_at
    from created_image;
  exception
    when unique_violation then
      if p_client_upload_id is null then
        raise;
      end if;

      return query
      select
        li.id,
        li.location_id,
        li.client_upload_id,
        li.url,
        li.storage_key,
        li.alt_text,
        li.caption,
        li.sort_order,
        li.is_cover,
        li.width,
        li.height,
        li.created_at,
        li.updated_at
      from public.location_images li
      where li.location_id = p_location_id
        and li.client_upload_id = p_client_upload_id
      limit 1;

      if found then
        return;
      end if;

      raise;
  end;
end;
$$;

revoke all on function public.finalize_location_image(uuid, uuid, text, text, text, text, integer, boolean, integer, integer) from public;
grant execute on function public.finalize_location_image(uuid, uuid, text, text, text, text, integer, boolean, integer, integer) to service_role;
