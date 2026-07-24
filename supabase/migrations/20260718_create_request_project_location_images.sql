create table public.request_project_location_images (
  id uuid primary key default gen_random_uuid(),
  request_project_location_id uuid not null references public.request_project_locations(id) on delete cascade,
  location_image_id uuid references public.location_images(id) on delete set null,
  sort_order integer not null default 0,
  image_url_snapshot text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index request_project_location_images_request_project_location_id_idx
  on public.request_project_location_images (request_project_location_id);

create index request_project_location_images_location_image_id_idx
  on public.request_project_location_images (location_image_id);

create index request_project_location_images_sort_order_idx
  on public.request_project_location_images (request_project_location_id, sort_order);

alter table public.request_project_location_images enable row level security;

create policy "Users can view images from their own request projects"
on public.request_project_location_images
for select
using (
  exists (
    select 1
    from public.request_project_locations request_project_location
    join public.request_projects request_project
      on request_project.id = request_project_location.request_project_id
    where request_project_location.id = request_project_location_images.request_project_location_id
      and request_project.user_id = auth.uid()
  )
);

create policy "Users can insert images into their own request projects"
on public.request_project_location_images
for insert
with check (
  exists (
    select 1
    from public.request_project_locations request_project_location
    join public.request_projects request_project
      on request_project.id = request_project_location.request_project_id
    where request_project_location.id = request_project_location_images.request_project_location_id
      and request_project.user_id = auth.uid()
  )
);

create policy "Users can update images from their own request projects"
on public.request_project_location_images
for update
using (
  exists (
    select 1
    from public.request_project_locations request_project_location
    join public.request_projects request_project
      on request_project.id = request_project_location.request_project_id
    where request_project_location.id = request_project_location_images.request_project_location_id
      and request_project.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.request_project_locations request_project_location
    join public.request_projects request_project
      on request_project.id = request_project_location.request_project_id
    where request_project_location.id = request_project_location_images.request_project_location_id
      and request_project.user_id = auth.uid()
  )
);

create policy "Users can delete images from their own request projects"
on public.request_project_location_images
for delete
using (
  exists (
    select 1
    from public.request_project_locations request_project_location
    join public.request_projects request_project
      on request_project.id = request_project_location.request_project_id
    where request_project_location.id = request_project_location_images.request_project_location_id
      and request_project.user_id = auth.uid()
  )
);
