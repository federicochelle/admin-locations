import type { LocationFormValues } from '../locations.types'

export const defaultInitialValues: LocationFormValues = {
  title: '',
  slug: '',
  description: '',
  category_id: '',
  department_id: '',
  zone_id: '',
  owner_id: '',
  status: 'draft',
  published: false,
  premium: false,
  featured: false,
  visibility_level: 'public',
  address_private: '',
  address_public: '',
  google_place_id: null,
  formatted_address: null,
  google_department_name: null,
  google_zone_name: null,
  address_components: null,
  lat: null,
  lng: null,
  approx_lat: null,
  approx_lng: null,
  show_exact_location: false,
  map_visibility: 'public',
  selectedFeatureIds: [],
  selectedTagIds: [],
}

export function toNullableString(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

export function normalizeInlineOwnerValue(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeDepartmentName(value: string | null | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return null
  }

  return trimmedValue
    .toLocaleLowerCase('es-UY')
    .replace(/^departamento de\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugifyTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getLocationAddressPickerValue(values: LocationFormValues) {
  return values.formatted_address ?? values.address_private
}

export function slugifyCategoryName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugifyZoneName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
