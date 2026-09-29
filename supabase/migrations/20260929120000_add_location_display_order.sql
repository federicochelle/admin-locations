alter table public.locations
add column if not exists display_order integer;

create or replace function public.assign_location_display_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_next_display_order integer;
begin
  if new.display_order is not null then
    return new;
  end if;

  select coalesce(max(l.display_order), 0) + 1
  into v_next_display_order
  from public.locations l
  where l.category_id is not distinct from new.category_id;

  new.display_order := v_next_display_order;

  return new;
end;
$$;

drop trigger if exists trg_assign_location_display_order on public.locations;

create trigger trg_assign_location_display_order
before insert
on public.locations
for each row
execute function public.assign_location_display_order();

with ordered_locations as (
  select
    id,
    row_number() over (
      partition by category_id
      order by
        location_code asc nulls last,
        id asc
    ) as next_display_order
  from public.locations
)
update public.locations as locations
set display_order = ordered_locations.next_display_order
from ordered_locations
where locations.id = ordered_locations.id
  and locations.display_order is null;

alter table public.locations
alter column display_order set not null;

alter table public.locations
drop constraint if exists locations_display_order_positive_check;

alter table public.locations
add constraint locations_display_order_positive_check
check (display_order >= 1);

create index if not exists locations_category_id_display_order_idx
on public.locations (category_id, display_order);
