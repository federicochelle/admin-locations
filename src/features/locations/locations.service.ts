import { annotateLocationDeleteFailure } from './location-edge-errors'
import { annotateAdminError, normalizeAdminError, reportAdminError } from '../../lib/admin-error-reporting'
import { getSupabaseClient } from '../../lib/supabase'
import { createActivityLog } from '../activity/activity-logs.service'
import type {
  LocationCategoryOption,
  LocationCreatePayload,
  LocationDepartmentOption,
  LocationEditableRecord,
  LocationFeatureOption,
  LocationTagOption,
  LocationFormOptions,
  LocationFeatureRelationRow,
  LocationTagRelationRow,
  LocationListItem,
  LocationNameRelation,
  LocationOwnerOption,
  LocationOwnerRelation,
  LocationSortDirection,
  LocationSortKey,
  PaginatedLocationsResult,
  SupabaseLocationEditableRow,
  LocationUpdatePayload,
  LocationZoneOption,
  SupabaseLocationRow,
} from './locations.types'

type LocationSlugRow = {
  id: string
  slug: string
}

type SupabaseErrorLike = {
  code?: string
  message?: string
}

type PaginatedLocationsInput = {
  page: number
  pageSize: number
  searchTerm: string
  sortKey: LocationSortKey
  sortDirection: LocationSortDirection
}

const LOCATION_LIST_SELECT = `
  id,
  title,
  slug,
  location_code,
  google_department_name,
  google_zone_name,
  formatted_address,
  location_images(url, is_cover),
  status,
  published,
  featured,
  premium,
  categories(name),
  departments(name),
  zones(name),
  owners(id, full_name, phone)
`

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeLikePattern(value: string) {
  return value.replace(/[%,()]/g, '')
}

function normalizeLocationCodeSearchTerm(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function buildLocationCodeSearchFilter(searchTerm: string) {
  const normalizedSearchTerm = normalizeLocationCodeSearchTerm(searchTerm)

  if (normalizedSearchTerm.length === 0) {
    return null
  }

  const tokens = normalizedSearchTerm
    .split(' ')
    .map((token) => escapeLikePattern(token))
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  const tokenFilters = tokens.map((token) => `location_code.ilike.%${token}%`)

  return tokenFilters.length === 1
    ? tokenFilters[0]
    : `and(${tokenFilters.join(',')})`
}

function normalizeLocationSlug(baseSlug: string) {
  const trimmed = baseSlug.trim()

  return trimmed.length > 0 ? trimmed : 'locacion'
}

function normalizeLocationPayloadTitle<T extends { title: string }>(payload: T): T {
  return {
    ...payload,
    title: payload.title.trim(),
  }
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
    throw normalizeAdminError(error)
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
  const googleDepartmentName = row.google_department_name?.trim() || null
  const googleZoneName = row.google_zone_name?.trim() || null
  const formattedAddress = row.formatted_address?.trim() || null
  const fallbackDepartmentName = getRelationName(row.departments)
  const fallbackZoneName = getRelationName(row.zones)

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
    googleDepartmentName,
    googleZoneName,
    departmentName: googleDepartmentName ?? fallbackDepartmentName,
    zoneName: googleZoneName ?? fallbackZoneName,
    formattedAddress,
    ownerId: getOwnerId(row.owners),
    ownerName: getOwnerName(row.owners),
    ownerPhone: getOwnerPhone(row.owners),
  }
}

type CreatedLocationRow = {
  id: string
  location_code: string | null
}

type DeleteLocationResult = {
  success: true
  alreadyDeleted?: boolean
  deletedLocationId: string
  deletedImagesCount: number
}

const DELETE_LOCATION_CONFIRMATION_ERROR_MESSAGE =
  'No pudimos confirmar la eliminación. Intentá nuevamente.'

function getSelectedRelationIds<T>(
  relation: T | T[] | null,
  getRelationId: (row: T) => string | null,
) {
  if (!relation) {
    return []
  }

  const rows = Array.isArray(relation) ? relation : [relation]

  return rows
    .map((row) => getRelationId(row))
    .filter((relationId): relationId is string => typeof relationId === 'string')
}

function getSelectedFeatureIds(
  relation:
    | LocationFeatureRelationRow
    | LocationFeatureRelationRow[]
    | null,
) {
  return getSelectedRelationIds(relation, (row) => row.feature_id)
}

function getSelectedTagIds(
  relation:
    | LocationTagRelationRow
    | LocationTagRelationRow[]
    | null,
) {
  return getSelectedRelationIds(relation, (row) => row.tag_id)
}

async function replaceLocationRelations(input: {
  locationId: string
  relationIds: string[]
  relationTable: 'location_features' | 'location_tags'
  relationColumn: 'feature_id' | 'tag_id'
}) {
  const supabase = getSupabaseClient()
  const { locationId, relationIds, relationTable, relationColumn } = input

  const { error: deleteRelationsError } = await supabase
    .from(relationTable)
    .delete()
    .eq('location_id', locationId)

  if (deleteRelationsError) {
    throw normalizeAdminError(deleteRelationsError)
  }

  if (relationIds.length === 0) {
    return
  }

  const relationRows = relationIds.map((relationId) => ({
    location_id: locationId,
    [relationColumn]: relationId,
  }))

  const { error: relationError } = await supabase
    .from(relationTable)
    .insert(relationRows)

  if (relationError) {
    throw normalizeAdminError(relationError)
  }
}

export async function getLocations(): Promise<LocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(LOCATION_LIST_SELECT)
    .order('title', { ascending: true })

  if (error) {
    throw normalizeAdminError(error)
  }

  const rows = (data ?? []) as SupabaseLocationRow[]

  return rows.map(mapLocation)
}

export async function getLocationsPage(
  input: PaginatedLocationsInput,
): Promise<PaginatedLocationsResult> {
  const supabase = getSupabaseClient()
  const page = Math.max(1, input.page)
  const pageSize = Math.max(1, input.pageSize)
  const searchTerm = input.searchTerm.trim()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const searchPattern = `%${escapeLikePattern(searchTerm)}%`

  let ownerIds: string[] = []

  if (searchTerm.length > 0) {
    const { data: ownerData, error: ownerError } = await supabase
      .from('owners')
      .select('id')
      .ilike('full_name', searchPattern)

    if (ownerError) {
      throw normalizeAdminError(ownerError)
    }

    ownerIds = ((ownerData ?? []) as { id: string | null }[])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  }

  let query = supabase
    .from('locations')
    .select(LOCATION_LIST_SELECT, { count: 'exact' })

  if (searchTerm.length > 0) {
    const filters: string[] = []
    const locationCodeFilter = buildLocationCodeSearchFilter(searchTerm)

    if (locationCodeFilter) {
      filters.push(locationCodeFilter)
    } else {
      filters.push(`location_code.ilike.${searchPattern}`)
    }

    if (ownerIds.length > 0) {
      filters.push(`owner_id.in.(${ownerIds.join(',')})`)
    }

    query = query.or(filters.join(','))
  }

  if (input.sortKey === 'departmentName') {
    query = query
      .order('google_department_name', {
        ascending: input.sortDirection === 'asc',
        nullsFirst: false,
      })
      .order('name', {
        referencedTable: 'departments',
        ascending: input.sortDirection === 'asc',
        nullsFirst: false,
      })
      .order('location_code', { ascending: true, nullsFirst: false })
  } else {
    query = query
      .order('location_code', {
        ascending: input.sortDirection === 'asc',
        nullsFirst: false,
      })
      .order('title', { ascending: true })
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    throw normalizeAdminError(error)
  }

  return {
    locations: ((data ?? []) as SupabaseLocationRow[]).map(mapLocation),
    totalCount: typeof count === 'number' ? count : 0,
  }
}

export async function getLocationsByCategory(
  categoryId: string,
): Promise<LocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(LOCATION_LIST_SELECT)
    .eq('category_id', categoryId)
    .order('title', { ascending: true })

  if (error) {
    throw normalizeAdminError(error)
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
    tagsResult,
  ] =
    await Promise.all([
      supabase.from('owners').select('id, full_name, phone').order('full_name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('zones').select('id, name, department_id').order('name'),
      supabase
        .from('features')
        .select('id, name, slug, aliases, group, type, active')
        .eq('active', true)
        .order('group', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('tags')
        .select('id, name, slug, group:category, active')
        .eq('active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true }),
    ])

  if (ownersResult.error) {
    throw normalizeAdminError(ownersResult.error)
  }

  if (categoriesResult.error) {
    throw normalizeAdminError(categoriesResult.error)
  }

  if (departmentsResult.error) {
    throw normalizeAdminError(departmentsResult.error)
  }

  if (zonesResult.error) {
    throw normalizeAdminError(zonesResult.error)
  }

  if (featuresResult.error) {
    throw normalizeAdminError(featuresResult.error)
  }

  if (tagsResult.error) {
    throw normalizeAdminError(tagsResult.error)
  }

  return {
    owners: (ownersResult.data ?? []) as LocationOwnerOption[],
    categories: (categoriesResult.data ?? []) as LocationCategoryOption[],
    departments: (departmentsResult.data ?? []) as LocationDepartmentOption[],
    zones: (zonesResult.data ?? []) as LocationZoneOption[],
    features: ((featuresResult.data ?? []) as Array<
      Omit<LocationFeatureOption, 'aliases'> & { aliases?: string[] | null }
    >).map((feature) => ({
      ...feature,
      aliases: Array.isArray(feature.aliases)
        ? feature.aliases
            .filter((alias): alias is string => typeof alias === 'string')
            .map((alias) => alias.trim())
            .filter((alias) => alias.length > 0)
        : [],
    })),
    tags: ((tagsResult.data ?? []) as LocationTagOption[]).map((tag) => ({
      ...tag,
      aliases: [],
    })),
  }
}

export async function createLocation(
  payload: LocationCreatePayload,
  options?: {
    actorProfileId?: string | null
    correlationId?: string
    onLocationCreated?: (locationId: string) => void
  },
): Promise<string> {
  let stage = 'payload'
  let observedLocationId: string | undefined = undefined
  const confirmedStages: string[] = []
  try {
    const supabase = getSupabaseClient()
    const { selectedFeatureIds, selectedTagIds, ...rawLocationPayload } = payload
    const locationPayload = normalizeLocationPayloadTitle(rawLocationPayload)
    stage = 'slug'
    const uniqueSlug = await getUniqueLocationSlug(locationPayload.slug)
    stage = 'location.insert'
    const { data, error } = await supabase
      .from('locations')
      .insert({
        ...locationPayload,
        slug: uniqueSlug,
        location_code: null,
      })
      .select('id, location_code')
      .single()

    if (isLocationSlugUniqueError(error)) {
      throw normalizeAdminError(error, 'Ya existe una locación con un código similar. Intentá guardar nuevamente.')
    }

    if (isLocationCodeUniqueError(error)) {
      throw normalizeAdminError(error, 'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.')
    }

    if (error) {
      throw normalizeAdminError(error)
    }

    const createdRow = data as CreatedLocationRow
    const locationId = createdRow.id
    observedLocationId = locationId
    confirmedStages.push('location.insert')
    options?.onLocationCreated?.(locationId)
    const generatedLocationCode = createdRow.location_code

    stage = 'relations.features'
    await replaceLocationRelations({
      locationId,
      relationIds: selectedFeatureIds,
      relationTable: 'location_features',
      relationColumn: 'feature_id',
    })

    confirmedStages.push('relations.features')
    stage = 'relations.tags'
    await replaceLocationRelations({
      locationId,
      relationIds: selectedTagIds,
      relationTable: 'location_tags',
      relationColumn: 'tag_id',
    })

    confirmedStages.push('relations.tags')
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
        reportAdminError(error, { operation: 'location.create', stage: 'activity_log', provider: 'supabase', resourceId: observedLocationId, correlationId: options?.correlationId, userFacing: false, outcome: 'partial', level: 'warning' })
        console.warn('No pudimos registrar activity_log para location.', error)
      }
    } else {
      console.warn('No se registró activity_log para location porque falta actorProfileId.')
    }

    return locationId
  } catch (error) {
    throw annotateAdminError(error, { operation: 'location.create', stage, provider: 'supabase', resourceId: observedLocationId, correlationId: options?.correlationId, outcome: confirmedStages.length ? 'partial' : (stage === 'payload' || stage === 'slug' || stage === 'load') ? 'failed' : 'unknown', extraSafeContext: { confirmed_stages: confirmedStages } })
  }
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
        location_features(feature_id),
        location_tags(tag_id)
      `,
    )
    .eq('id', id)
    .single()

  if (error) {
    throw normalizeAdminError(error)
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
    selectedTagIds: getSelectedTagIds(row.location_tags),
  }
}

export async function updateLocation(
  id: string,
  payload: LocationUpdatePayload,
  options?: { actorProfileId?: string | null; correlationId?: string },
): Promise<string> {
  let stage = 'payload'
  const observedLocationId: string | undefined = id
  const confirmedStages: string[] = []
  try {
    const supabase = getSupabaseClient()
    const { selectedFeatureIds, selectedTagIds, ...rawLocationPayload } = payload
    const locationPayload = normalizeLocationPayloadTitle(rawLocationPayload)
    stage = 'slug'
    const uniqueSlug = await getUniqueLocationSlug(locationPayload.slug, id)
    stage = 'load'
    const { data: currentLocationData, error: currentLocationError } = await supabase
      .from('locations')
      .select('category_id, location_code')
      .eq('id', id)
      .single()

    if (currentLocationError) {
      throw normalizeAdminError(currentLocationError)
    }

    const currentCategoryId =
      ((currentLocationData as { category_id: string | null } | null)?.category_id ??
        null)
    const currentLocationCode =
      ((currentLocationData as { location_code: string | null } | null)?.location_code ??
        null)
    const nextCategoryId = locationPayload.category_id
    const shouldRegenerateLocationCode = currentCategoryId !== nextCategoryId
    const updatePayload = shouldRegenerateLocationCode
      ? {
          ...locationPayload,
          slug: uniqueSlug,
          location_code: null,
        }
      : {
          ...locationPayload,
          slug: uniqueSlug,
        }

    stage = 'location.update'
    const { data, error } = await supabase
      .from('locations')
      .update(updatePayload)
      .eq('id', id)
      .select('id, location_code')
      .single()

    if (isLocationSlugUniqueError(error)) {
      throw normalizeAdminError(error, 'Ya existe una locación con un código similar. Intentá guardar nuevamente.')
    }

    if (isLocationCodeUniqueError(error)) {
      throw normalizeAdminError(error, 'No pudimos asignar un código único a la locación. Intentá guardar nuevamente.')
    }

    if (error) {
      throw normalizeAdminError(error)
    }

    const updatedRow = data as CreatedLocationRow
    confirmedStages.push('location.update')
    const finalLocationCode = updatedRow.location_code ?? currentLocationCode

    stage = 'relations.features'
    await replaceLocationRelations({
      locationId: id,
      relationIds: selectedFeatureIds,
      relationTable: 'location_features',
      relationColumn: 'feature_id',
    })

    confirmedStages.push('relations.features')
    stage = 'relations.tags'
    await replaceLocationRelations({
      locationId: id,
      relationIds: selectedTagIds,
      relationTable: 'location_tags',
      relationColumn: 'tag_id',
    })

    confirmedStages.push('relations.tags')
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
        reportAdminError(error, { operation: 'location.update', stage: 'activity_log', provider: 'supabase', resourceId: observedLocationId, correlationId: options?.correlationId, userFacing: false, outcome: 'partial', level: 'warning' })
        console.warn('No pudimos registrar activity_log de edición para location.', error)
      }
    } else {
      console.warn('No se registró activity_log de edición para location porque falta actorProfileId.')
    }

    return updatedRow.id
  } catch (error) {
    throw annotateAdminError(error, { operation: 'location.update', stage, provider: 'supabase', resourceId: observedLocationId, correlationId: options?.correlationId, outcome: confirmedStages.length ? 'partial' : (stage === 'payload' || stage === 'slug' || stage === 'load') ? 'failed' : 'unknown', extraSafeContext: { confirmed_stages: confirmedStages } })
  }
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
    throw normalizeAdminError(error)
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
    if (isAmbiguousDeleteTransportError(error)) {
      const wasDeleted = await reconcileDeletedLocation(supabase, id)

      if (wasDeleted) {
        return id
      }

      throw new Error(DELETE_LOCATION_CONFIRMATION_ERROR_MESSAGE)
    }

    throw await annotateLocationDeleteFailure(error)
  }

  if (!data) {
    throw new Error('No recibimos datos al eliminar la locación.')
  }

  return data.deletedLocationId
}

function getErrorName(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
    ? error.name
    : null
}

function getErrorMessageValue(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : null
}

function isAmbiguousDeleteTransportError(error: unknown) {
  const errorName = getErrorName(error)

  if (
    errorName === 'FunctionsFetchError' ||
    errorName === 'FunctionsRelayError' ||
    errorName === 'AbortError' ||
    errorName === 'TimeoutError'
  ) {
    return true
  }

  const errorMessage = getErrorMessageValue(error)?.toLocaleLowerCase() ?? ''

  return (
    error instanceof TypeError &&
    (errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('abort'))
  )
}

async function reconcileDeletedLocation(
  supabase: ReturnType<typeof getSupabaseClient>,
  id: string,
) {
  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(DELETE_LOCATION_CONFIRMATION_ERROR_MESSAGE)
  }

  return !data
}

// Future feature growth for locations should stay in this service layer,
// for example getLocationById(), updateLocation() and deleteLocation().
