alter table public.reservations
  add column if not exists google_event_id text,
  add column if not exists google_sync_status text,
  add column if not exists google_synced_at timestamptz,
  add column if not exists google_sync_error text;

update public.reservations
set google_sync_status = case
  when status = 'confirmed' then 'pending'
  else 'not_applicable'
end
where google_sync_status is null;

alter table public.reservations
  alter column google_sync_status set default 'not_applicable';

update public.reservations
set google_sync_status = 'not_applicable'
where google_sync_status is null;

alter table public.reservations
  alter column google_sync_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'reservations'
      and con.conname = 'reservations_google_sync_status_check'
  ) then
    alter table public.reservations
      add constraint reservations_google_sync_status_check
      check (
        google_sync_status = any (
          array[
            'not_applicable'::text,
            'pending'::text,
            'synced'::text,
            'error'::text
          ]
        )
      );
  end if;
end
$$;

grant select, update
on public.reservations
to service_role;
