create or replace function public.guard_request_project_immutable_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'closed' then
    raise exception 'request project is immutable in status %', old.status
      using errcode = '25006';
  end if;

  if old.status = 'confirmed' then
    if new.status is distinct from old.status
      and new.status in ('pending', 'discarded')
      and (to_jsonb(new) - array['status', 'updated_at'])
        = (to_jsonb(old) - array['status', 'updated_at'])
    then
      return new;
    end if;

    raise exception 'request project is immutable in status %', old.status
      using errcode = '25006';
  end if;

  return new;
end;
$$;
