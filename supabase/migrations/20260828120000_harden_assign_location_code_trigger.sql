-- Location code allocation is intentionally scoped by prefix namespace.
-- Different categories that share a location_code_prefix also share numbering.
create or replace function public.assign_location_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.location_code is null and new.category_id is not null then
      new.location_code := public.allocate_location_code(new.category_id);
    end if;

    return new;
  end if;

  if new.category_id is distinct from old.category_id then
    if new.category_id is null then
      new.location_code := null;
    else
      new.location_code := public.allocate_location_code(new.category_id);
    end if;

    return new;
  end if;

  if new.location_code is null then
    new.location_code := old.location_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_location_code on public.locations;

create trigger trg_assign_location_code
before insert or update
on public.locations
for each row
execute function public.assign_location_code();
