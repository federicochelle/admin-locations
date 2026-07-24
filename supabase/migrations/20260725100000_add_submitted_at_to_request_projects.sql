alter table public.request_projects
add column if not exists submitted_at timestamptz;

update public.request_projects
set submitted_at = coalesce(
  submitted_at,
  official_pdf_uploaded_at,
  updated_at,
  created_at,
  timezone('utc'::text, now())
)
where status = 'submitted'
  and submitted_at is null
  and official_pdf_bucket is not null
  and official_pdf_path is not null
  and official_pdf_file_name is not null
  and official_pdf_generated_at is not null
  and official_pdf_uploaded_at is not null
  and official_pdf_size_bytes is not null;

create or replace function public.finalize_request_project_submission(
  p_request_project_id uuid,
  p_official_pdf_bucket text,
  p_official_pdf_path text,
  p_official_pdf_file_name text,
  p_official_pdf_generated_at timestamptz,
  p_official_pdf_uploaded_at timestamptz,
  p_official_pdf_size_bytes bigint
)
returns table (
  id uuid,
  status text,
  official_pdf_bucket text,
  official_pdf_path text,
  official_pdf_file_name text,
  official_pdf_generated_at timestamptz,
  official_pdf_uploaded_at timestamptz,
  official_pdf_size_bytes bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_request_project public.request_projects%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para enviar la solicitud.';
  end if;

  if p_official_pdf_bucket is null or btrim(p_official_pdf_bucket) = '' then
    raise exception 'Falta el bucket del PDF oficial.';
  end if;

  if p_official_pdf_path is null or btrim(p_official_pdf_path) = '' then
    raise exception 'Falta la ruta del PDF oficial.';
  end if;

  if p_official_pdf_file_name is null or btrim(p_official_pdf_file_name) = '' then
    raise exception 'Falta el nombre del PDF oficial.';
  end if;

  if p_official_pdf_generated_at is null or p_official_pdf_uploaded_at is null then
    raise exception 'Faltan fechas del PDF oficial.';
  end if;

  if p_official_pdf_size_bytes is null or p_official_pdf_size_bytes <= 0 then
    raise exception 'El tamano del PDF oficial no es valido.';
  end if;

  select request_project.*
  into v_request_project
  from public.request_projects request_project
  where request_project.id = p_request_project_id
    and request_project.user_id = auth.uid();

  if not found then
    raise exception 'No tienes permisos para enviar esta solicitud.';
  end if;

  if v_request_project.status not in ('draft', 'submitted') then
    raise exception 'La solicitud no se puede finalizar en su estado actual.';
  end if;

  if not exists (
    select 1
    from storage.objects storage_object
    where storage_object.bucket_id = p_official_pdf_bucket
      and storage_object.name = p_official_pdf_path
  ) then
    raise exception 'No encontramos el PDF oficial subido.';
  end if;

  return query
  update public.request_projects
  set
    status = 'submitted',
    submitted_at = coalesce(
      request_projects.submitted_at,
      timezone('utc'::text, now())
    ),
    official_pdf_bucket = btrim(p_official_pdf_bucket),
    official_pdf_path = btrim(p_official_pdf_path),
    official_pdf_file_name = btrim(p_official_pdf_file_name),
    official_pdf_generated_at = p_official_pdf_generated_at,
    official_pdf_uploaded_at = p_official_pdf_uploaded_at,
    official_pdf_size_bytes = p_official_pdf_size_bytes,
    updated_at = timezone('utc'::text, now())
  where request_projects.id = p_request_project_id
    and request_projects.user_id = auth.uid()
  returning
    request_projects.id,
    request_projects.status::text,
    request_projects.official_pdf_bucket,
    request_projects.official_pdf_path,
    request_projects.official_pdf_file_name,
    request_projects.official_pdf_generated_at,
    request_projects.official_pdf_uploaded_at,
    request_projects.official_pdf_size_bytes;
end;
$$;

grant execute on function public.finalize_request_project_submission(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  bigint
) to authenticated;
