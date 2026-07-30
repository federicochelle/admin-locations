do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'reservations'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid, true) ilike '%status%'
      and (
        pg_get_constraintdef(con.oid, true) ilike '%tentative%' or
        pg_get_constraintdef(con.oid, true) ilike '%confirmed%' or
        pg_get_constraintdef(con.oid, true) ilike '%cancelled%' or
        pg_get_constraintdef(con.oid, true) ilike '%pending%'
      )
  loop
    execute format(
      'alter table public.reservations drop constraint if exists %I',
      constraint_name
    );
  end loop;
end
$$;

update public.reservations
set status = 'pending'
where status = 'tentative';

alter table public.reservations
  alter column status set default 'pending';

alter table public.reservations
  add constraint reservations_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'confirmed'::text,
        'cancelled'::text
      ]
    )
  );
