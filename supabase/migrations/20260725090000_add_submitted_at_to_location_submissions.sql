alter table public.location_submissions
add column if not exists submitted_at timestamptz;

update public.location_submissions
set submitted_at = coalesce(submitted_at, created_at, timezone('utc'::text, now()))
where submitted_at is null;

alter table public.location_submissions
alter column submitted_at set default timezone('utc'::text, now());

alter table public.location_submissions
alter column submitted_at set not null;
