create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null default 'primary',
  google_account_email text not null,
  refresh_token text not null,
  scopes text[] not null default '{}'::text[],
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  connected_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  connected_by_user_id uuid not null references auth.users(id) on delete restrict,

  constraint google_calendar_connections_singleton_key unique (connection_key),
  constraint google_calendar_connections_connection_key_check
    check (connection_key = 'primary'),
  constraint google_calendar_connections_email_not_blank_check
    check (btrim(google_account_email) <> ''),
  constraint google_calendar_connections_refresh_token_not_blank_check
    check (btrim(refresh_token) <> '')
);

create table if not exists public.google_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_nonce text not null unique,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),

  constraint google_calendar_oauth_states_state_nonce_not_blank_check
    check (btrim(state_nonce) <> ''),
  constraint google_calendar_oauth_states_expiration_check
    check (expires_at > issued_at)
);

create or replace function public.google_calendar_connections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists google_calendar_connections_set_updated_at on public.google_calendar_connections;

create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections
for each row
execute function public.google_calendar_connections_set_updated_at();

create unique index if not exists google_calendar_connections_active_idx
  on public.google_calendar_connections (is_active)
  where is_active = true;

create unique index if not exists google_calendar_oauth_states_nonce_idx
  on public.google_calendar_oauth_states (state_nonce);

create index if not exists google_calendar_oauth_states_active_lookup_idx
  on public.google_calendar_oauth_states (admin_user_id, state_nonce, expires_at)
  where used_at is null;

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

grant select, insert, update, delete
on public.google_calendar_connections
to service_role;

grant select, insert, update, delete
on public.google_calendar_oauth_states
to service_role;
