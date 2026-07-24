alter table public.request_project_locations
add column if not exists location_code_snapshot text,
add column if not exists location_title_snapshot text,
add column if not exists category_slug_snapshot text,
add column if not exists cover_image_url_snapshot text;
