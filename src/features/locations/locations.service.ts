import { getSupabaseClient } from '../../lib/supabase'
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
    coverImageUrl: getCoverImageUrl(row),
    status: row.status,
    published: row.published ?? false,
    featured: row.featured ?? false,
    premium: row.premium ?? false,
    categoryName: getRelationName(row.categories),
    departmentName: getRelationName(row.departments),
    zoneName: getRelationName(row.zones),
    ownerName: getOwnerName(row.owners),
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
        location_images(url, is_cover),
        status,
        published,
        featured,
        premium,
        categories(name),
        departments(name),
        zones(name),
        owners(full_name)
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
        location_images(url, is_cover),
        status,
        published,
        featured,
        premium,
        categories(name),
        departments(name),
        zones(name),
        owners(full_name)
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
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, ...locationPayload } = payload

  const { data, error } = await supabase
    .from('locations')
    .insert(locationPayload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const locationId = (data as CreatedLocationRow).id

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
        short_description,
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
    short_description: row.short_description,
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
    show_exact_location: row.show_exact_location,
    map_visibility: row.map_visibility,
    selectedFeatureIds: getSelectedFeatureIds(row.location_features),
  }
}

export async function updateLocation(
  id: string,
  payload: LocationUpdatePayload,
): Promise<string> {
  const supabase = getSupabaseClient()
  const { selectedFeatureIds, ...locationPayload } = payload

  const { data, error } = await supabase
    .from('locations')
    .update(locationPayload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
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

  return (data as CreatedLocationRow).id
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
