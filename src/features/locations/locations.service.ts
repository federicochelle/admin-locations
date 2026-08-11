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

const LOCATION_CODE_PREFIX_MAP: Record<string, string> = {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeLikePattern(value: string) {
  return value.replace(/[%,()]/g, '')
}

function normalizeLocationSlug(baseSlug: string) {
  const trimmed = baseSlug.trim()

  return trimmed.length > 0 ? trimmed : 'locacion'
}

function normalizeLocationCategoryNameForCode(categoryName: string) {
  const trimmed = categoryName.trim()

  if (trimmed.toLocaleLowerCase() === 'locales de ropa') {
    return 'Local de ropa'
  }

  return trimmed
}

function normalizeLocationCodePrefix(categoryName: string) {
  const normalizedCategoryName = normalizeLocationCategoryNameForCode(categoryName)
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

  return LOCATION_CODE_PREFIX_MAP[normalized] ?? normalized
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
}

type DeleteLocationResult = {
  success: true
  deletedLocationId: string
  deletedImagesCount: number
}

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
    throw new Error(deleteRelationsError.message)
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
    throw new Error(relationError.message)
  }
}

export async function getLocations(): Promise<LocationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('locations')
    .select(LOCATION_LIST_SELECT)
    .order('title', { ascending: true })

  if (error) {
    throw new Error(error.message)
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
      throw new Error(ownerError.message)
    }

    ownerIds = ((ownerData ?? []) as { id: string | null }[])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  }

  let query = supabase
    .from('locations')
    .select(LOCATION_LIST_SELECT, { count: 'exact' })

  if (searchTerm.length > 0) {
    const filters = [`location_code.ilike.${searchPattern}`]

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
    throw new Error(error.message)
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

  if (tagsResult.error) {
    throw new Error(tagsResult.error.message)
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
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, selectedTagIds, ...rawLocationPayload } = payload
  const locationPayload = normalizeLocationPayloadTitle(rawLocationPayload)
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

  await replaceLocationRelations({
    locationId,
    relationIds: selectedFeatureIds,
    relationTable: 'location_features',
    relationColumn: 'feature_id',
  })

  await replaceLocationRelations({
    locationId,
    relationIds: selectedTagIds,
    relationTable: 'location_tags',
    relationColumn: 'tag_id',
  })

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
        location_features(feature_id),
        location_tags(tag_id)
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
    selectedTagIds: getSelectedTagIds(row.location_tags),
  }
}

export async function updateLocation(
  id: string,
  payload: LocationUpdatePayload,
  options?: { actorProfileId?: string | null },
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, selectedTagIds, ...rawLocationPayload } = payload
  const locationPayload = normalizeLocationPayloadTitle(rawLocationPayload)
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

  await replaceLocationRelations({
    locationId: id,
    relationIds: selectedFeatureIds,
    relationTable: 'location_features',
    relationColumn: 'feature_id',
  })

  await replaceLocationRelations({
    locationId: id,
    relationIds: selectedTagIds,
    relationTable: 'location_tags',
    relationColumn: 'tag_id',
  })

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
