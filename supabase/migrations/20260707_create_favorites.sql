create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_location_key unique (user_id, location_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
on public.favorites
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);
