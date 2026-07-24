alter table public.features
add column if not exists aliases text[] not null default '{}';
