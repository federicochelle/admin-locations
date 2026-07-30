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

type OwnerRelation =
  | {
      id: string | null
      full_name: string | null
      phone: string | null
      email: string | null
    }
  | {
      id: string | null
      full_name: string | null
      phone: string | null
      email: string | null
    }[]
  | null

type RequestProjectLocationItem = {
  id: string
  location_id: string
  reservations?:
    | {
        id: string
        status: string | null
      }[]
    | null
  locations:
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
        owners?: OwnerRelation
      }
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
        owners?: OwnerRelation
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
  production_company?: string | null
  message: string | null
  status: LocationRequestStatus
  created_at: string
  submitted_at?: string | null
  updated_at: string | null
  official_pdf_bucket?: string | null
  official_pdf_path?: string | null
  official_pdf_file_name?: string | null
  official_pdf_generated_at?: string | null
  official_pdf_uploaded_at?: string | null
  official_pdf_size_bytes?: number | null
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

function getLegacyCompanyNameFromMessage(message: string | null | undefined) {
  if (!message?.trim()) {
    return null
  }

  for (const line of message.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      continue
    }

    const match = trimmedLine.match(/^([^:]+):\s*(.+)$/)

    if (!match) {
      continue
    }

    const normalizedKey = match[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-UY')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    const normalizedValue = match[2]?.trim() ?? ''

    if (normalizedValue.length === 0) {
      continue
    }

    if (
      normalizedKey.includes('empresa') ||
      normalizedKey.includes('compania') ||
      normalizedKey.includes('compan ia')
    ) {
      return normalizedValue
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

function getOptionalNumberValue(row: RequestProjectRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
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
        owners?: OwnerRelation
      }
    | {
        id: string
        title: string | null
        location_code?: string | null
        location_images?: LocationImageRelation
        categories?: NameRelation
        departments?: NameRelation
        zones?: NameRelation
        owners?: OwnerRelation
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

function getOwnerRelation(relation: OwnerRelation) {
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
  const linkedReservation = item.reservations?.[0] ?? null

  if (!location) {
    return null
  }

  return {
    id: location.id,
    requestProjectLocationId: item.id,
    reservationId: linkedReservation?.id ?? null,
    reservationRecordStatus: linkedReservation?.status?.trim() || null,
    title: location.title?.trim() || 'Locacion sin titulo',
    locationCode: location.location_code?.trim() || null,
    coverImageUrl: getCoverImageUrl(location.location_images ?? null),
    categoryName: getRelationName(location.categories ?? null)?.trim() || null,
    departmentName: getRelationName(location.departments ?? null)?.trim() || null,
    zoneName: getRelationName(location.zones ?? null)?.trim() || null,
    ownerId: getOwnerRelation(location.owners ?? null)?.id?.trim() || null,
    ownerName: getOwnerRelation(location.owners ?? null)?.full_name?.trim() || null,
    ownerPhone: getOwnerRelation(location.owners ?? null)?.phone?.trim() || null,
    ownerEmail: getOwnerRelation(location.owners ?? null)?.email?.trim() || null,
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
          id,
          location_id,
          reservations(
            id,
            status
          ),
          locations(
            id,
            title
          )
        )
      `,
    )
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false, nullsFirst: false })

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
      submittedAt:
        getOptionalStringValue(row, [
          'submitted_at',
          'official_pdf_uploaded_at',
          'updated_at',
        ]) ?? row.created_at,
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

export async function getPendingRequestsCount(): Promise<number> {
  const supabase = getSupabaseClient()

  const { count, error } = await supabase
    .from('request_projects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
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

export async function createRequestProjectLocationReservation(input: {
  requestProjectLocationId: string
  startsAt: string
  endsAt: string
}): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.rpc(
    'create_request_project_location_reservation',
    {
      p_request_project_location_id: input.requestProjectLocationId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  const reservation =
    Array.isArray(data) ? data[0] : data

  if (
    !reservation ||
    typeof reservation !== 'object' ||
    !('id' in reservation) ||
    typeof reservation.id !== 'string'
  ) {
    throw new Error('No recibimos la reserva creada.')
  }

  return reservation.id
}

export async function deleteAdminLocationRequest(
  requestId: string,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('request_projects')
    .delete()
    .eq('id', requestId)

  if (error) {
    throw new Error(error.message)
  }

  return requestId
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
          id,
          location_id,
          reservations(
            id,
            status
          ),
          locations(
            id,
            title,
            location_code,
            location_images(url, is_cover),
            categories(name),
            departments(name),
            zones(name),
            owners(id, full_name, phone, email)
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
    productionCompany:
      row.production_company?.trim() ||
      getLegacyCompanyNameFromMessage(row.message) ||
      null,
    message: row.message?.trim() || null,
    status: row.status,
    createdAt: row.created_at,
    submittedAt:
      getOptionalStringValue(row, [
        'submitted_at',
        'official_pdf_uploaded_at',
        'updated_at',
      ]) ?? row.created_at,
    updatedAt: row.updated_at,
    requester: {
      userId: row.user_id,
      fullName: profile?.full_name?.trim() || null,
      email: profile?.email?.trim() || null,
      phone: profile?.phone?.trim() || null,
    },
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
    officialPdf: (() => {
      const bucket = getOptionalStringValue(row, ['official_pdf_bucket'])
      const path = getOptionalStringValue(row, ['official_pdf_path'])

      if (!bucket || !path) {
        return null
      }

      return {
        bucket,
        path,
        fileName: getOptionalStringValue(row, ['official_pdf_file_name']),
        generatedAt: getOptionalStringValue(row, ['official_pdf_generated_at']),
        uploadedAt: getOptionalStringValue(row, ['official_pdf_uploaded_at']),
        sizeBytes: getOptionalNumberValue(row, ['official_pdf_size_bytes']),
      }
    })(),
    locations,
  }
}
