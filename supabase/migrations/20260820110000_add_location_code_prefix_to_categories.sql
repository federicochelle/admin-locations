alter table public.categories
add column if not exists location_code_prefix text;

with normalized_categories as (
  select
    id,
    trim(name) as trimmed_name,
    upper(
      regexp_replace(
        trim(
          both '-'
          from regexp_replace(
            translate(
              case
                when lower(trim(name)) = 'locales de ropa' then 'Local de ropa'
                else trim(name)
              end,
              'áàäâãéèëêẽíìïîĩóòöôõúùüûũñÁÀÄÂÃÉÈËÊẼÍÌÏÎĨÓÒÖÔÕÚÙÜÛŨÑ',
              'aaaaaeeeeeiiiiiooooouuuuunaAAAAAEEEEEIIIIIOOOOOUUUUUN'
            ),
            '[^[:alnum:]]+',
            '-',
            'g'
          )
        ),
        '(^-+|-+$)',
        '',
        'g'
      )
    ) as normalized_name
  from public.categories
)
update public.categories as categories
set location_code_prefix = case normalized_categories.normalized_name
  when 'ALMACENES' then 'ALMACEN'
  when 'ESTANCIAS' then 'ESTANCIA'
  when 'CASAS' then 'CASA'
  when 'CALLES' then 'CALLE'
  when 'APARTAMENTOS' then 'APARTAMENTO'
  when 'PEATONALES' then 'PEATONAL'
  when 'PISCINAS' then 'PISCINA'
  when 'PLAZAS' then 'PLAZA'
  when 'PARQUES' then 'PARQUE'
  when 'CAFETERIAS' then 'CAFETERIA'
  when 'CANCHAS-DE-FUTBOL' then 'CANCHA DE FUTBOL'
  when 'BARES' then 'BAR'
  when 'MUSEOS' then 'MUSEO'
  when 'OFICINAS' then 'OFICINA'
  when 'RESTAURANTES' then 'RESTAURANTE'
  when 'ESTADIOS' then 'ESTADIO'
  when 'CANCHAS-DE-BASQUET' then 'CANCHA DE BASQUET'
  when 'GIMNASIOS' then 'GIMNASIO'
  when 'EDIFICIOS' then 'EDIFICIO'
  when 'GALPONES' then 'GALPON'
  when '' then 'CATEGORIA'
  else normalized_categories.normalized_name
end
from normalized_categories
where categories.id = normalized_categories.id
  and coalesce(trim(categories.location_code_prefix), '') = '';
