export const LEGACY_LOCATION_CODE_PREFIX_MAP: Record<string, string> = {
  ALMACENES: 'ALMACEN',
  ESTANCIAS: 'ESTANCIA',
  CASAS: 'CASA',
  CALLES: 'CALLE',
  APARTAMENTOS: 'APARTAMENTO',
  PEATONALES: 'PEATONAL',
  PISCINAS: 'PISCINA',
  PLAZAS: 'PLAZA',
  PARQUES: 'PARQUE',
  CAFETERIAS: 'CAFETERIA',
  'CANCHAS-DE-FUTBOL': 'CANCHA DE FUTBOL',
  BARES: 'BAR',
  MUSEOS: 'MUSEO',
  OFICINAS: 'OFICINA',
  RESTAURANTES: 'RESTAURANTE',
  ESTADIOS: 'ESTADIO',
  'CANCHAS-DE-BASQUET': 'CANCHA DE BASQUET',
  GIMNASIOS: 'GIMNASIO',
  EDIFICIOS: 'EDIFICIO',
  GALPONES: 'GALPON',
}

export function normalizeCategoryLocationCodePrefixInput(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

export function getLegacyLocationCodeCategoryName(categoryName: string) {
  const trimmed = categoryName.trim()

  if (trimmed.toLocaleLowerCase() === 'locales de ropa') {
    return 'Local de ropa'
  }

  return trimmed
}

export function getLegacyLocationCodePrefix(categoryName: string) {
  const normalizedCategoryName = getLegacyLocationCodeCategoryName(categoryName)
  const normalized = normalizedCategoryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()

  if (normalized.length === 0) {
    return 'CATEGORIA'
  }

  return LEGACY_LOCATION_CODE_PREFIX_MAP[normalized] ?? normalized
}
