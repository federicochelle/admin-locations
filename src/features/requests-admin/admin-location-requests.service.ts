import { getSupabaseClient } from '../../lib/supabase'
import type {
  AdminLocationRequest,
  AdminLocationRequestDetail,
  AdminRequestLocation,
  LocationRequestStatus,
} from './admin-location-requests.types'

type NameRelation =
  | {
      name: string | null
    }
  | {
      name: string | null
    }[]
  | null

type LocationImageRelation =
  | {
      url: string | null
      is_cover: boolean | null
    }[]
  | null

type RequestProjectLocationItem = {
  location_id: string
  locations:
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
      }
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
      }[]
    | null
}

type RequestProjectLocationRelation =
  | RequestProjectLocationItem[]
  | null

type RequestProjectRow = {
  id: string
  user_id: string
  title: string | null
  message: string | null
  status: LocationRequestStatus
  created_at: string
  updated_at: string | null
  request_project_locations: RequestProjectLocationRelation
  [key: string]: unknown
}

type ProfileRow = {
  user_id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  phone: string | null
}

function getOptionalStringValue(row: RequestProjectRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string') {
      const normalizedValue = value.trim()

      if (normalizedValue.length > 0) {
        return normalizedValue
      }
    }
  }

  return null
}

function getRequestEmail(row: RequestProjectRow) {
  return getOptionalStringValue(row, [
    'email',
    'requester_email',
    'contact_email',
    'applicant_email',
    'user_email',
  ])
}

function getRelationName(relation: NameRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null
  }

  return relation.name
}

function getLocationRelation(
  relation:
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
      }
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
      }[]
    | null,
) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation
}

function getCoverImageUrl(images: LocationImageRelation) {
  const coverImage = (images ?? []).find((image) => image.is_cover === true)

  return coverImage?.url ?? null
}

function getLocationNames(relation: RequestProjectLocationRelation): string[] {
  if (!relation || relation.length === 0) {
    return []
  }

  const names = relation
    .map((item) => getLocationRelation(item.locations)?.title?.trim() || null)
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(names))
}

function mapLocationItemToDetail(item: RequestProjectLocationItem): AdminRequestLocation | null {
  const location = getLocationRelation(item.locations)

  if (!location) {
    return null
  }

  return {
    id: location.id,
    title: location.title?.trim() || 'Locacion sin titulo',
    locationCode: location.location_code?.trim() || null,
    coverImageUrl: getCoverImageUrl(location.location_images ?? null),
    categoryName: getRelationName(location.categories ?? null)?.trim() || null,
    departmentName: getRelationName(location.departments ?? null)?.trim() || null,
    zoneName: getRelationName(location.zones ?? null)?.trim() || null,
  }
}

export async function getAdminLocationRequests(): Promise<AdminLocationRequest[]> {
  const supabase = getSupabaseClient()

  const { data: requestsData, error: requestsError } = await supabase
    .from('request_projects')
    .select(
      `
        *,
        request_project_locations(
          location_id,
          locations(
            id,
            title
          )
        )
      `,
    )
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  if (requestsError) {
    throw new Error(requestsError.message)
  }

  const requestRows = (requestsData ?? []) as RequestProjectRow[]
  const uniqueUserIds = Array.from(new Set(requestRows.map((row) => row.user_id)))

  let profilesByUserId = new Map<string, ProfileRow>()

  if (uniqueUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, company_name, phone')
      .in('user_id', uniqueUserIds)

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    profilesByUserId = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [
        profile.user_id,
        profile,
      ]),
    )
  }

  return requestRows.map((row) => {
    const profile = profilesByUserId.get(row.user_id) ?? null
    const locationNames = getLocationNames(row.request_project_locations)
    const title = row.title?.trim()

    return {
      id: row.id,
      userId: row.user_id,
      title:
        title && title.length > 0
          ? title
          : locationNames[0] ?? 'Solicitud sin titulo',
      message: row.message?.trim() || null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requesterFullName: profile?.full_name?.trim() || null,
      requesterEmail: getRequestEmail(row),
      requesterCompanyName: profile?.company_name?.trim() || null,
      requesterPhone: profile?.phone?.trim() || null,
      locationCount: locationNames.length,
      locationNames,
    }
  })
}

export async function updateAdminLocationRequestStatus(
  requestId: string,
  status: LocationRequestStatus,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_projects')
    .update({ status })
    .eq('id', requestId)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.id) {
    throw new Error('No recibimos confirmación al actualizar la solicitud.')
  }

  return data.id
}

export async function getAdminLocationRequestById(
  requestId: string,
): Promise<AdminLocationRequestDetail> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_projects')
    .select(
      `
        *,
        request_project_locations(
          location_id,
          locations(
            id,
            title,
            location_code,
            location_images(url, is_cover),
            categories(name),
            departments(name),
            zones(name)
          )
        )
      `,
    )
    .eq('id', requestId)
    .neq('status', 'draft')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = (data ?? null) as RequestProjectRow | null

  if (!row) {
    throw new Error('REQUEST_NOT_FOUND')
  }

  let profile: ProfileRow | null = null

  if (row.user_id) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, company_name, phone')
      .eq('user_id', row.user_id)
      .maybeSingle()

    if (profileError) {
      throw new Error(profileError.message)
    }

    profile = (profileData ?? null) as ProfileRow | null
  }

  const locations =
    row.request_project_locations
      ?.map(mapLocationItemToDetail)
      .filter((location): location is AdminRequestLocation => location !== null) ?? []

  const title = row.title?.trim()

  return {
    id: row.id,
    userId: row.user_id,
    title:
      title && title.length > 0
        ? title
        : locations[0]?.title ?? 'Solicitud sin titulo',
    message: row.message?.trim() || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterFullName: profile?.full_name?.trim() || null,
    requesterEmail: getRequestEmail(row),
    requesterCompanyName: profile?.company_name?.trim() || null,
    requesterPhone: profile?.phone?.trim() || null,
    locationManagerName: getOptionalStringValue(row, [
      'location_manager_name',
      'location_manager',
      'location_contact_name',
      'jefe_de_locaciones',
      'jefe_locaciones',
    ]),
    tentativeStartDate: getOptionalStringValue(row, [
      'tentative_start_date',
      'tentative_from',
      'start_date',
      'from_date',
      'fecha_tentativa_desde',
      'fecha_desde',
    ]),
    tentativeEndDate: getOptionalStringValue(row, [
      'tentative_end_date',
      'tentative_to',
      'end_date',
      'to_date',
      'fecha_tentativa_hasta',
      'fecha_hasta',
    ]),
    pdfUrl: getOptionalStringValue(row, [
      'pdf_url',
      'request_pdf_url',
      'document_url',
      'pdf_public_url',
    ]),
    locations,
  }
}
