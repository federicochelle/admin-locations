alter table public.request_projects
add column if not exists tentative_start_date date,
add column if not exists tentative_end_date date;

alter table public.request_projects
drop constraint if exists request_projects_tentative_date_range_check;

alter table public.request_projects
add constraint request_projects_tentative_date_range_check
check (
  tentative_start_date is null
  or tentative_end_date is null
  or tentative_end_date >= tentative_start_date
);
