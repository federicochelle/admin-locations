import { resolvePublicLocationCoordinates } from '../location-public-coordinates'
import { toNullableString } from './location-form.helpers'
import type {
  LocationCreatePayload,
  LocationFormValues,
  LocationUpdatePayload,
} from '../locations.types'

type BuildLocationPayloadMode = 'create' | 'edit' | 'view'

export function buildPayload(
  values: LocationFormValues,
  options?: {
    mode?: BuildLocationPayloadMode
    initialValues?: LocationFormValues
  },
): LocationCreatePayload | LocationUpdatePayload {
  const deduplicatedSelectedFeatureIds = Array.from(
    new Set(values.selectedFeatureIds),
  )
  const deduplicatedSelectedTagIds = Array.from(new Set(values.selectedTagIds))
  const publicCoordinates = resolvePublicLocationCoordinates({
    lat: values.lat,
    lng: values.lng,
    currentPublicLat: values.approx_lat,
    currentPublicLng: values.approx_lng,
    previousLat: options?.mode === 'edit' ? options.initialValues?.lat ?? null : null,
    previousLng: options?.mode === 'edit' ? options.initialValues?.lng ?? null : null,
  })

  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: toNullableString(values.description),
    category_id: values.category_id || null,
    department_id: values.department_id || null,
    zone_id: values.zone_id || null,
    owner_id: values.owner_id || null,
    status: 'published',
    published: true,
    premium: values.premium,
    featured: values.featured,
    visibility_level: values.visibility_level,
    address_private: toNullableString(values.address_private),
    address_public: toNullableString(values.address_public),
    google_place_id: values.google_place_id,
    formatted_address: values.formatted_address,
    google_department_name: values.google_department_name,
    google_zone_name: values.google_zone_name,
    address_components: values.address_components,
    lat: values.lat,
    lng: values.lng,
    approx_lat: publicCoordinates?.lat ?? null,
    approx_lng: publicCoordinates?.lng ?? null,
    show_exact_location: values.show_exact_location,
    map_visibility: values.map_visibility,
    selectedFeatureIds: deduplicatedSelectedFeatureIds,
    selectedTagIds: deduplicatedSelectedTagIds,
  }
}
