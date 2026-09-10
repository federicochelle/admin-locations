alter table public.location_images
  add column if not exists client_upload_id uuid;

create unique index if not exists location_images_location_client_upload_id_key
  on public.location_images (location_id, client_upload_id)
  where client_upload_id is not null;
