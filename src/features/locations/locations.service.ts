import { getSupabaseClient } from '../../lib/supabase'
import { createActivityLog } from '../activity/activity-logs.service'
import type {
  LocationCategoryOption,
  LocationCreatePayload,
  LocationDepartmentOption,
  LocationEditableRecord,
  LocationFeatureOption,
  LocationFormOptions,
  LocationFeatureRelationRow,
  LocationListItem,
  LocationNameRelation,
  LocationOwnerOption,
  LocationOwnerRelation,
  SupabaseLocationEditableRow,
  LocationUpdatePayload,
  LocationZoneOption,
  SupabaseLocationRow,
} from './locations.types'

type LocationSlugRow = {
  id: string
  slug: string
}

type LocationCodeRow = {
  location_code: string | null
}

type CategoryNameRow = {
  name: string | null
}

type SupabaseErrorLike = {
  code?: string
  message?: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeLocationSlug(baseSlug: string) {
  const trimmed = baseSlug.trim()

  return trimmed.length > 0 ? trimmed : 'locacion'
}

function normalizeLocationCodePrefix(categoryName: string) {
  const normalized = categoryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()

  return normalized.length > 0 ? normalized : 'CATEGORIA'
}

function isLocationSlugUniqueError(error: SupabaseErrorLike | null) {
  if (!error) {
    return false
  }

  return (
    error.code === '23505' ||
    error.message?.includes('locations_slug_key') === true
  )
}

function isLocationCodeUniqueError(error: SupabaseErrorLike | null) {
  if (!error) {
    return false
  }

  return (
    error.code === '23505' &&
    (error.message?.includes('locations_location_code_key') === true ||
      error.message?.includes('location_code') === true)
  )
}

async function getUniqueLocationSlug(
  baseSlug: string,
  currentLocationId?: string,
): Promise<string> {
  const normalizedBaseSlug = normalizeLocationSlug(baseSlug)
  const supabase = getSupabaseClient()

  let query = supabase
    .from('locations')
    .select('id, slug')
    .like('slug', `${normalizedBaseSlug}%`)

  if (currentLocationId) {
    query = query.neq('id', currentLocationId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as LocationSlugRow[]
  const slugPattern = new RegExp(`^${escapeRegExp(normalizedBaseSlug)}(?:-(\\d+))?$`)

  const matchingSlugs = rows
    .map((row) => row.slug)
    .filter((slug) => slugPattern.test(slug))

  if (!matchingSlugs.includes(normalizedBaseSlug)) {
    return normalizedBaseSlug
  }

  const maxSuffix = matchingSlugs.reduce((highest, slug) => {
    if (slug === normalizedBaseSlug) {
      return Math.max(highest, 1)
    }

    const match = slug.match(slugPattern)
    const parsedSuffix = Number.parseInt(match?.[1] ?? '', 10)

    if (Number.isNaN(parsedSuffix)) {
      return highest
    }

    return Math.max(highest, parsedSuffix)
  }, 1)

  return `${normalizedBaseSlug}-${maxSuffix + 1}`
}

async function getNextLocationCode(categoryId: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .single()

  if (categoryError) {
    throw new Error(categoryError.message)
  }

  const categoryName = ((categoryData as CategoryNameRow | null)?.name ?? '').trim()

  if (categoryName.length === 0) {
    throw new Error('No pudimos generar el código de la locación porque la categoría no es válida.')
  }

  const prefix = normalizeLocationCodePrefix(categoryName)
  const { data: locationData, error: locationError } = await supabase
    .from('locations')
    .select('location_code')
    .eq('category_id', categoryId)
    .not('location_code', 'is', null)

  if (locationError) {
    throw new Error(locationError.message)
  }

  const rows = (locationData ?? []) as LocationCodeRow[]
  const maxSequence = rows.reduce((highest, row) => {
    const code = row.location_code?.trim()

    if (!code) {
      return highest
    }

    const match = code.match(/-(\d+)$/)
    const parsedSequence = Number.parseInt(match?.[1] ?? '', 10)

    if (Number.isNaN(parsedSequence)) {
      return highest
    }

    return Math.max(highest, parsedSequence)
  }, 0)

  return `${prefix}-${String(maxSequence + 1).padStart(3, '0')}`
}

function getRelationName(relation: LocationNameRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null
  }

  return relation.name
}

function getOwnerName(relation: LocationOwnerRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.full_name ?? null
  }

  return relation.full_name
}

function getOwnerPhone(relation: LocationOwnerRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.phone ?? null
  }

  return relation.phone
}

function getOwnerId(relation: LocationOwnerRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.id ?? null
  }

  return relation.id
}

function getCoverImageUrl(row: SupabaseLocationRow) {
  const images = row.location_images ?? []
  const coverImage = images.find((image) => image.is_cover === true)

  return coverImage?.url ?? null
}

function mapLocation(row: SupabaseLocationRow): LocationListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    locationCode: row.location_code,
    coverImageUrl: getCoverImageUrl(row),
    status: row.status,
    published: row.published ?? false,
    featured: row.featured ?? false,
    premium: row.premium ?? false,
    categoryName: getRelationName(row.categories),
    departmentName: getRelationName(row.departments),
    zoneName: getRelationName(row.zones),
    ownerId: getOwnerId(row.owners),
    ownerName: getOwnerName(row.owners),
    ownerPhone: getOwnerPhone(row.owners),
  }
}

type CreatedLocationRow = {
  id: string
}

type DeleteLocationResult = {
  success: true
  deletedLocationId: string
  deletedImagesCount: number
}

type LocationFeatureInsertRow = {
  location_id: string
  feature_id: string
}

function getSelectedFeatureIds(
  relation:
    | LocationFeatureRelationRow
    | LocationFeatureRelationRow[]
    | null,
) {
  if (!relation) {
    return []
  }

  const rows = Array.isArray(relation) ? relation : [relation]

  return rows
    .map((row) => row.feature_id)
    .filter((featureId): featureId is string => Boolean(featureId))
}

export async function getLocations(): Promise<LocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      `
        id,
        title,
        slug,
        location_code,
        location_images(url, is_cover),
        status,
        published,
        featured,
        premium,
        categories(name),
        departments(name),
        zones(name),
        owners(id, full_name, phone)
      `,
    )
    .order('title', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SupabaseLocationRow[]

  return rows.map(mapLocation)
}

export async function getLocationsByCategory(
  categoryId: string,
): Promise<LocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      `
        id,
        title,
        slug,
        location_code,
        location_images(url, is_cover),
        status,
        published,
        featured,
        premium,
        categories(name),
        departments(name),
        zones(name),
        owners(id, full_name, phone)
      `,
    )
    .eq('category_id', categoryId)
    .order('title', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SupabaseLocationRow[]

  return rows.map(mapLocation)
}

export async function getLocationFormOptions(): Promise<LocationFormOptions> {
  const supabase = getSupabaseClient()

  const [
    ownersResult,
    categoriesResult,
    departmentsResult,
    zonesResult,
    featuresResult,
  ] =
    await Promise.all([
      supabase.from('owners').select('id, full_name').order('full_name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('zones').select('id, name, department_id').order('name'),
      supabase
        .from('features')
        .select('id, name, group, active')
        .eq('active', true)
        .order('group', { ascending: true })
        .order('name', { ascending: true }),
    ])

  if (ownersResult.error) {
    throw new Error(ownersResult.error.message)
  }

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message)
  }

  if (departmentsResult.error) {
    throw new Error(departmentsResult.error.message)
  }

  if (zonesResult.error) {
    throw new Error(zonesResult.error.message)
  }

  if (featuresResult.error) {
    throw new Error(featuresResult.error.message)
  }

  return {
    owners: (ownersResult.data ?? []) as LocationOwnerOption[],
    categories: (categoriesResult.data ?? []) as LocationCategoryOption[],
    departments: (departmentsResult.data ?? []) as LocationDepartmentOption[],
    zones: (zonesResult.data ?? []) as LocationZoneOption[],
    features: (featuresResult.data ?? []) as LocationFeatureOption[],
  }
}

export async function createLocation(
  payload: LocationCreatePayload,
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, ...locationPayload } = payload
  const uniqueSlug = await getUniqueLocationSlug(locationPayload.slug)
  let createdRow: CreatedLocationRow | null = null
  let generatedLocationCode: string | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const locationCode = locationPayload.category_id
      ? await getNextLocationCode(locationPayload.category_id)
      : null
    generatedLocationCode = locationCode

    const { data, error } = await supabase
      .from('locations')
      .insert({
        ...locationPayload,
        slug: uniqueSlug,
        location_code: locationCode,
      })
      .select('id')
      .single()

    if (!error) {
      createdRow = data as CreatedLocationRow
      break
    }

    if (isLocationCodeUniqueError(error) && attempt < 2) {
      continue
    }

    if (isLocationSlugUniqueError(error)) {
      throw new Error(
        'Ya existe una locación con un código similar. Intentá guardar nuevamente.',
      )
    }

    if (isLocationCodeUniqueError(error)) {
      throw new Error(
        'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.',
      )
    }

    throw new Error(error.message)
  }

  if (!createdRow) {
    throw new Error(
      'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.',
    )
  }

  const locationId = createdRow.id

  if (selectedFeatureIds.length > 0) {
    const relationRows: LocationFeatureInsertRow[] = selectedFeatureIds.map(
      (featureId) => ({
        location_id: locationId,
        feature_id: featureId,
      }),
    )

    const { error: relationError } = await supabase
      .from('location_features')
      .insert(relationRows)

    if (relationError) {
      throw new Error(relationError.message)
    }
  }

  if (options?.actorProfileId) {
    try {
      const locationTitle = locationPayload.title.trim()

      await createActivityLog({
        actorProfileId: options.actorProfileId,
        action: 'created',
        entityType: 'location',
        entityId: locationId,
        entityName: generatedLocationCode ?? (locationTitle || 'Sin código'),
      })
    } catch (error) {
      console.warn('No pudimos registrar activity_log para location.', error)
    }
  } else {
    console.warn('No se registró activity_log para location porque falta actorProfileId.')
  }

  return locationId
}

export async function getLocationById(
  id: string,
): Promise<LocationEditableRecord> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      `
        id,
        title,
        slug,
        location_code,
        description,
        owner_id,
        category_id,
        department_id,
        zone_id,
        status,
        published,
        premium,
        featured,
        visibility_level,
        address_public,
        address_private,
        google_place_id,
        formatted_address,
        google_department_name,
        google_zone_name,
        address_components,
        lat,
        lng,
        approx_lat,
        approx_lng,
        show_exact_location,
        map_visibility,
        location_features(feature_id)
      `,
    )
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as SupabaseLocationEditableRow

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    location_code: row.location_code,
    description: row.description,
    owner_id: row.owner_id,
    category_id: row.category_id,
    department_id: row.department_id,
    zone_id: row.zone_id,
    status: row.status,
    published: row.published,
    premium: row.premium,
    featured: row.featured,
    visibility_level: row.visibility_level,
    address_public: row.address_public,
    address_private: row.address_private,
    google_place_id: row.google_place_id,
    formatted_address: row.formatted_address,
    google_department_name: row.google_department_name,
    google_zone_name: row.google_zone_name,
    address_components: row.address_components,
    lat: row.lat,
    lng: row.lng,
    approx_lat: row.approx_lat,
    approx_lng: row.approx_lng,
    show_exact_location: row.show_exact_location,
    map_visibility: row.map_visibility,
    selectedFeatureIds: getSelectedFeatureIds(row.location_features),
  }
}

export async function updateLocation(
  id: string,
  payload: LocationUpdatePayload,
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, ...locationPayload } = payload
  const uniqueSlug = await getUniqueLocationSlug(locationPayload.slug, id)
  const { data: currentLocationData, error: currentLocationError } = await supabase
    .from('locations')
    .select('category_id, location_code')
    .eq('id', id)
    .single()

  if (currentLocationError) {
    throw new Error(currentLocationError.message)
  }

  const currentCategoryId =
    ((currentLocationData as { category_id: string | null } | null)?.category_id ??
      null)
  const currentLocationCode =
    ((currentLocationData as { location_code: string | null } | null)?.location_code ??
      null)
  const nextCategoryId = locationPayload.category_id
  const shouldRegenerateLocationCode = currentCategoryId !== nextCategoryId
  let updatedRow: CreatedLocationRow | null = null
  let finalLocationCode = currentLocationCode

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextLocationCode =
      shouldRegenerateLocationCode && nextCategoryId
        ? await getNextLocationCode(nextCategoryId)
        : undefined

    if (shouldRegenerateLocationCode) {
      finalLocationCode = nextLocationCode ?? null
    }

    const updatePayload = shouldRegenerateLocationCode
      ? {
          ...locationPayload,
          slug: uniqueSlug,
          location_code: nextLocationCode ?? null,
        }
      : {
          ...locationPayload,
          slug: uniqueSlug,
        }

    const { data, error } = await supabase
      .from('locations')
      .update(updatePayload)
      .eq('id', id)
      .select('id')
      .single()

    if (!error) {
      updatedRow = data as CreatedLocationRow
      break
    }

    if (
      shouldRegenerateLocationCode &&
      isLocationCodeUniqueError(error) &&
      attempt < 2
    ) {
      continue
    }

    if (isLocationSlugUniqueError(error)) {
      throw new Error(
        'Ya existe una locación con un código similar. Intentá guardar nuevamente.',
      )
    }

    if (isLocationCodeUniqueError(error)) {
      throw new Error(
        'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.',
      )
    }

    throw new Error(error.message)
  }

  if (!updatedRow) {
    throw new Error(
      'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.',
    )
  }

  const { error: deleteRelationsError } = await supabase
    .from('location_features')
    .delete()
    .eq('location_id', id)

  if (deleteRelationsError) {
    throw new Error(deleteRelationsError.message)
  }

  if (selectedFeatureIds.length > 0) {
    const relationRows: LocationFeatureInsertRow[] = selectedFeatureIds.map(
      (featureId) => ({
        location_id: id,
        feature_id: featureId,
      }),
    )

    const { error: relationError } = await supabase
      .from('location_features')
      .insert(relationRows)

    if (relationError) {
      throw new Error(relationError.message)
    }
  }

  if (options?.actorProfileId) {
    try {
      const locationTitle = locationPayload.title.trim()

      await createActivityLog({
        actorProfileId: options.actorProfileId,
        action: 'updated',
        entityType: 'location',
        entityId: updatedRow.id,
        entityName: finalLocationCode ?? (locationTitle || 'Sin código'),
      })
    } catch (error) {
      console.warn('No pudimos registrar activity_log de edición para location.', error)
    }
  } else {
    console.warn('No se registró activity_log de edición para location porque falta actorProfileId.')
  }

  return updatedRow.id
}

async function updateLocationStatus(
  id: string,
  payload: Pick<LocationUpdatePayload, 'status' | 'published'>,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CreatedLocationRow).id
}

export async function archiveLocation(id: string): Promise<string> {
  return updateLocationStatus(id, {
    status: 'draft',
    published: false,
  })
}

export async function publishLocation(id: string): Promise<string> {
  return updateLocationStatus(id, {
    status: 'published',
    published: true,
  })
}

export async function deleteLocation(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.functions.invoke<DeleteLocationResult>(
    'location-delete',
    {
      body: {
        locationId: id,
      },
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('No recibimos datos al eliminar la locación.')
  }

  return data.deletedLocationId
}

// Future feature growth for locations should stay in this service layer,
// for example getLocationById(), updateLocation() and deleteLocation().
