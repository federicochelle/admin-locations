create or replace function public.list_admin_request_projects(
  p_status text default null,
  p_limit integer default null,
  p_offset integer default 0
)
returns setof public.request_projects
language sql
stable
security invoker
set search_path = public
as $$
  select request_project.*
  from public.request_projects as request_project
  where request_project.status <> 'draft'
    and (p_status is null or request_project.status::text = p_status)
  order by
    coalesce(request_project.submitted_at, request_project.created_at) desc,
    request_project.id desc
  limit case when p_limit is null then null else greatest(p_limit, 1) end
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.list_admin_request_projects(text, integer, integer) to authenticated;
