alter table public.locations
add column if not exists location_code text;

create unique index if not exists locations_location_code_key
on public.locations (location_code)
where location_code is not null;
