import { getSupabaseClient } from '../../lib/supabase'
import type {
  AdminLocationRequest,
  AdminLocationRequestDetail,
  AdminRequestLocation,
  AdminLocationRequestVersion,
  CreateAdminManualRequestInput,
  LocationRequestStatus,
  PaginatedAdminLocationRequestsResult,
  RequestProjectLocationStatus,
} from './admin-location-requests.types'
import {
  buildRequestProjectMessageWithContactMetadata,
  parseRequestProjectMessageWithContactMetadata,
} from './request-project-contact'

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

type CurrentLocationRow = {
  id: string
  title: string | null
  location_code?: string | null
  location_images?: LocationImageRelation
  categories?: NameRelation
  departments?: NameRelation
  zones?: NameRelation
  owners?: OwnerRelation
}

type RequestProjectLocationLegacyRow = {
  id: string
  request_project_id: string
  location_id: string
  status: string | null
  location_code_snapshot: string | null
  location_title_snapshot: string | null
  reservations?:
    | {
        id: string
        starts_at: string | null
        ends_at: string | null
        status: string | null
      }[]
    | null
}

type ReservationByRequestProjectLocationRow = {
  id: string
  request_project_location_id: string | null
  starts_at: string | null
  ends_at: string | null
  status: string | null
}

type RequestProjectVersionRow = {
  id: string
  request_project_id: string
  version_number: number | null
  created_at?: string | null
  snapshot_payload: unknown
  official_pdf_bucket?: string | null
  official_pdf_path?: string | null
  official_pdf_file_name?: string | null
  official_pdf_generated_at?: string | null
  official_pdf_uploaded_at?: string | null
  official_pdf_size_bytes?: number | null
}

type RequestProjectVersionLocationStatusRow = {
  request_project_version_id: string
  location_id: string
  status: string | null
}

type RequestProjectRow = {
  id: string
  user_id: string
  title: string | null
  production_company?: string | null
  message: string | null
  status: LocationRequestStatus | 'draft'
  created_at: string
  submitted_at?: string | null
  updated_at: string | null
  official_pdf_bucket?: string | null
  official_pdf_path?: string | null
  official_pdf_file_name?: string | null
  official_pdf_generated_at?: string | null
  official_pdf_uploaded_at?: string | null
  official_pdf_size_bytes?: number | null
  admin_active_version_id?: string | null
  [key: string]: unknown
}

type ProfileRow = {
  user_id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  phone: string | null
}

type ManualRequestLocationRow = {
  id: string
  title: string | null
  location_code?: string | null
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

function normalizeLocationRequestStatus(
  value: string | null | undefined,
): LocationRequestStatus {
  switch (value) {
    case 'pending':
    case 'confirmed':
    case 'discarded':
      return value
    default:
      return 'pending'
  }
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
  const explicitValue = getOptionalStringValue(row, [
    'email',
    'requester_email',
    'contact_email',
    'applicant_email',
    'user_email',
  ])

  if (explicitValue) {
    return explicitValue
  }

  return parseRequestProjectMessageWithContactMetadata(row.message).contactEmail
}

function getRequestPhone(row: RequestProjectRow) {
  const explicitValue = getOptionalStringValue(row, [
    'phone',
    'contact_phone',
    'requester_phone',
    'applicant_phone',
    'user_phone',
  ])

  if (explicitValue) {
    return explicitValue
  }

  return parseRequestProjectMessageWithContactMetadata(row.message).contactPhone
}

function getRequestFullName(row: RequestProjectRow) {
  const explicitValue = getOptionalStringValue(row, [
    'full_name',
    'contact_name',
    'requester_name',
    'applicant_name',
    'user_name',
  ])

  if (explicitValue) {
    return explicitValue
  }

  return parseRequestProjectMessageWithContactMetadata(row.message).contactName
}

function normalizeNullableString(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeNullableDate(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
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

function normalizeRequestProjectLocationStatus(
  value: string | null | undefined,
): RequestProjectLocationStatus {
  return value === 'confirmed' || value === 'cancelled' ? value : 'pending'
}

function getLocationNamesFromRequestProjectLocations(
  locations: Array<Pick<RequestProjectLocationLegacyRow, 'location_title_snapshot'>>,
): string[] {
  if (locations.length === 0) {
    return []
  }

  const names = locations
    .map((location) => location.location_title_snapshot?.trim() || null)
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(names))
}

function getUniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  )
}

async function getVersionsByRequestId(
  requestId: string,
): Promise<RequestProjectVersionRow[]> {
  if (!requestId) {
    return []
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('request_project_versions')
    .select('*')
    .eq('request_project_id', requestId)
    .order('version_number', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as RequestProjectVersionRow[]
}

async function getLocationsById(locationIds: string[]) {
  const normalizedLocationIds = getUniqueValues(locationIds)

  if (normalizedLocationIds.length === 0) {
    return new Map<string, CurrentLocationRow>()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('locations')
    .select(
      `
        id,
        title,
        location_code,
        location_images(url, is_cover),
        categories(name),
        departments(name),
        zones(name),
        owners(id, full_name, phone, email)
      `,
    )
    .in('id', normalizedLocationIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map(
    ((data ?? []) as CurrentLocationRow[]).map((location) => [location.id, location]),
  )
}

async function getRequestProjectLocationsByRequestIds(requestIds: string[]) {
  const normalizedRequestIds = getUniqueValues(requestIds)

  if (normalizedRequestIds.length === 0) {
    return new Map<string, RequestProjectLocationLegacyRow[]>()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('request_project_locations')
    .select(
      `
        id,
        request_project_id,
        location_id,
        status,
        location_code_snapshot,
        location_title_snapshot
      `,
    )
    .in('request_project_id', normalizedRequestIds)

  if (error) {
    throw new Error(error.message)
  }

  const locationsByRequestId = new Map<string, RequestProjectLocationLegacyRow[]>()

  for (const row of (data ?? []) as RequestProjectLocationLegacyRow[]) {
    const currentRows = locationsByRequestId.get(row.request_project_id) ?? []
    currentRows.push(row)
    locationsByRequestId.set(row.request_project_id, currentRows)
  }

  return locationsByRequestId
}

async function getRequestProjectLocationsByRequestId(requestId: string) {
  if (!requestId) {
    return []
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('request_project_locations')
    .select(
      `
        id,
        request_project_id,
        location_id,
        status,
        location_code_snapshot,
        location_title_snapshot,
        reservations(
          id,
          starts_at,
          ends_at,
          status
        )
      `,
    )
    .eq('request_project_id', requestId)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as RequestProjectLocationLegacyRow[]
}

async function getReservationsByRequestProjectLocationId(
  requestProjectLocationIds: string[],
) {
  const normalizedRequestProjectLocationIds = getUniqueValues(requestProjectLocationIds)

  if (normalizedRequestProjectLocationIds.length === 0) {
    return new Map<string, ReservationByRequestProjectLocationRow>()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('id, request_project_location_id, starts_at, ends_at, status')
    .in('request_project_location_id', normalizedRequestProjectLocationIds)

  if (error) {
    throw new Error(error.message)
  }

  const reservationsByRequestProjectLocationId = new Map<
    string,
    ReservationByRequestProjectLocationRow
  >()

  for (const row of (data ?? []) as ReservationByRequestProjectLocationRow[]) {
    const requestProjectLocationId = row.request_project_location_id?.trim() || ''

    if (!requestProjectLocationId || reservationsByRequestProjectLocationId.has(requestProjectLocationId)) {
      continue
    }

    reservationsByRequestProjectLocationId.set(requestProjectLocationId, row)
  }

  return reservationsByRequestProjectLocationId
}

async function getVersionLocationStatusesByLocationId(
  requestProjectVersionId: string,
  locationIds: string[],
) {
  const normalizedLocationIds = getUniqueValues(locationIds)

  if (!requestProjectVersionId || normalizedLocationIds.length === 0) {
    return new Map<string, RequestProjectLocationStatus>()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('request_project_version_location_statuses')
    .select('request_project_version_id, location_id, status')
    .eq('request_project_version_id', requestProjectVersionId)
    .in('location_id', normalizedLocationIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map(
    ((data ?? []) as RequestProjectVersionLocationStatusRow[]).map((row) => [
      row.location_id,
      normalizeRequestProjectLocationStatus(row.status),
    ]),
  )
}

function getRequestProjectOfficialPdf(
  row:
    | RequestProjectRow
    | RequestProjectVersionRow
    | null,
) {
  if (!row) {
    return null
  }

  const bucket =
    typeof row.official_pdf_bucket === 'string' && row.official_pdf_bucket.trim()
      ? row.official_pdf_bucket.trim()
      : null
  const path =
    typeof row.official_pdf_path === 'string' && row.official_pdf_path.trim()
      ? row.official_pdf_path.trim()
      : null

  if (!bucket || !path) {
    return null
  }

  return {
    bucket,
    path,
    fileName:
      typeof row.official_pdf_file_name === 'string' && row.official_pdf_file_name.trim()
        ? row.official_pdf_file_name.trim()
        : null,
    generatedAt:
      typeof row.official_pdf_generated_at === 'string' && row.official_pdf_generated_at.trim()
        ? row.official_pdf_generated_at.trim()
        : null,
    uploadedAt:
      typeof row.official_pdf_uploaded_at === 'string' && row.official_pdf_uploaded_at.trim()
        ? row.official_pdf_uploaded_at.trim()
        : null,
    sizeBytes:
      typeof row.official_pdf_size_bytes === 'number' && Number.isFinite(row.official_pdf_size_bytes)
        ? row.official_pdf_size_bytes
        : null,
  }
}

function hasAdminActiveVersionColumn(row: RequestProjectRow) {
  return Object.prototype.hasOwnProperty.call(row, 'admin_active_version_id')
}

async function persistAdminActiveVersionId(input: {
  requestId: string
  requestProjectVersionId: string
}) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('request_projects')
    .update({
      admin_active_version_id: input.requestProjectVersionId,
    })
    .eq('id', input.requestId)

  if (error) {
    throw new Error(error.message)
  }
}

function mapRequestProjectVersions(input: {
  activeVersionId: string | null
  latestVersionId: string | null
  versions: RequestProjectVersionRow[]
}): AdminLocationRequestVersion[] {
  return input.versions.map((version) => ({
    id: version.id,
    versionNumber:
      typeof version.version_number === 'number' && Number.isFinite(version.version_number)
        ? version.version_number
        : null,
    createdAt:
      typeof version.created_at === 'string' && version.created_at.trim()
        ? version.created_at.trim()
        : null,
    isActive: version.id === input.activeVersionId,
    isLatest: version.id === input.latestVersionId,
  }))
}

function mapRequestProjectLocationToDetail(input: {
  currentLocation: CurrentLocationRow | null
  legacyLocation: RequestProjectLocationLegacyRow
  linkedReservation: ReservationByRequestProjectLocationRow | null
  requestProjectVersionId: string
  statusByLocationId: Map<string, RequestProjectLocationStatus>
}): AdminRequestLocation {
  const {
    currentLocation,
    legacyLocation,
    linkedReservation,
    requestProjectVersionId,
    statusByLocationId,
  } = input
  const fallbackLegacyReservation = legacyLocation.reservations?.[0] ?? null
  const resolvedReservation = linkedReservation ?? fallbackLegacyReservation
  const owner = getOwnerRelation(currentLocation?.owners ?? null)

  return {
    id: legacyLocation.location_id,
    rowKey: legacyLocation.id,
    requestProjectVersionId,
    requestProjectLocationId: legacyLocation.id,
    requestProjectLocationStatus:
      statusByLocationId.get(legacyLocation.location_id) ??
      normalizeRequestProjectLocationStatus(legacyLocation.status),
    reservationId: resolvedReservation?.id ?? null,
    reservationRecordStatus: resolvedReservation?.status?.trim() || null,
    reservationStartsAt: resolvedReservation?.starts_at?.trim() || null,
    reservationEndsAt: resolvedReservation?.ends_at?.trim() || null,
    title:
      currentLocation?.title?.trim() ||
      legacyLocation.location_title_snapshot?.trim() ||
      'Locacion sin titulo',
    locationCode:
      currentLocation?.location_code?.trim() ||
      legacyLocation.location_code_snapshot?.trim() ||
      null,
    coverImageUrl: getCoverImageUrl(currentLocation?.location_images ?? null),
    categoryName: getRelationName(currentLocation?.categories ?? null)?.trim() || null,
    departmentName: getRelationName(currentLocation?.departments ?? null)?.trim() || null,
    zoneName: getRelationName(currentLocation?.zones ?? null)?.trim() || null,
    ownerId: owner?.id?.trim() || null,
    ownerName: owner?.full_name?.trim() || null,
    ownerPhone: owner?.phone?.trim() || null,
    ownerEmail: owner?.email?.trim() || null,
  }
}

function getCanonicalSubmittedAt(row: RequestProjectRow) {
  return row.submitted_at?.trim() || row.created_at
}

export async function getAdminLocationRequests(): Promise<AdminLocationRequest[]> {
  const supabase = getSupabaseClient()

  const { data: requestsData, error: requestsError } = await supabase
    .from('request_projects')
    .select('*')
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })

  if (requestsError) {
    throw new Error(requestsError.message)
  }

  const requestRows = (requestsData ?? []) as RequestProjectRow[]
  const uniqueUserIds = Array.from(new Set(requestRows.map((row) => row.user_id)))
  const requestProjectLocationsByRequestId = await getRequestProjectLocationsByRequestIds(
    requestRows.map((row) => row.id),
  )

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

  return requestRows
    .map((row) => {
      const profile = profilesByUserId.get(row.user_id) ?? null
      const requestProjectLocations = requestProjectLocationsByRequestId.get(row.id) ?? []
      const locationNames = getLocationNamesFromRequestProjectLocations(requestProjectLocations)
      const title = row.title?.trim()
      const requestContact = parseRequestProjectMessageWithContactMetadata(row.message)

      return {
        id: row.id,
        userId: row.user_id,
        title:
          title && title.length > 0
            ? title
            : locationNames[0] ?? 'Solicitud sin titulo',
        message: requestContact.notes,
        status: normalizeLocationRequestStatus(row.status),
        submittedAt: getCanonicalSubmittedAt(row),
        updatedAt: row.updated_at,
        requesterFullName:
          requestContact.contactName ||
          getRequestFullName(row) ||
          profile?.full_name?.trim() ||
          null,
        requesterEmail: getRequestEmail(row),
        requesterCompanyName: profile?.company_name?.trim() || null,
        requesterPhone:
          requestContact.contactPhone ||
          getRequestPhone(row) ||
          profile?.phone?.trim() ||
          null,
        locationCount: requestProjectLocations.length,
        locationNames,
      }
    })
    .sort(
      (leftRequest, rightRequest) =>
        new Date(rightRequest.submittedAt).getTime() -
        new Date(leftRequest.submittedAt).getTime() ||
        rightRequest.id.localeCompare(leftRequest.id),
    )
}

export async function getAdminLocationRequestsPage(input: {
  page: number
  pageSize: number
  status: 'all' | LocationRequestStatus
}): Promise<PaginatedAdminLocationRequestsResult> {
  const supabase = getSupabaseClient()
  const safePage = Math.max(1, input.page)
  const safePageSize = Math.max(1, input.pageSize)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = supabase
    .from('request_projects')
    .select('*', { count: 'exact' })
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (input.status !== 'all') {
    query = query.eq('status', input.status)
  }

  const { data: requestsData, count, error: requestsError } = await query

  if (requestsError) {
    throw new Error(requestsError.message)
  }

  const requestRows = (requestsData ?? []) as RequestProjectRow[]
  const requestIds = requestRows.map((row) => row.id)
  const uniqueUserIds = Array.from(new Set(requestRows.map((row) => row.user_id)))
  const requestProjectLocationsByRequestId = await getRequestProjectLocationsByRequestIds(
    requestIds,
  )

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

  return {
    items: requestRows.map((row) => {
      const profile = profilesByUserId.get(row.user_id) ?? null
      const requestProjectLocations = requestProjectLocationsByRequestId.get(row.id) ?? []
      const locationNames = getLocationNamesFromRequestProjectLocations(requestProjectLocations)
      const title = row.title?.trim()
      const requestContact = parseRequestProjectMessageWithContactMetadata(row.message)

      return {
        id: row.id,
        userId: row.user_id,
        title:
          title && title.length > 0
            ? title
            : locationNames[0] ?? 'Solicitud sin titulo',
        message: requestContact.notes,
        status: normalizeLocationRequestStatus(row.status),
        submittedAt: getCanonicalSubmittedAt(row),
        updatedAt: row.updated_at,
        requesterFullName:
          requestContact.contactName ||
          getRequestFullName(row) ||
          profile?.full_name?.trim() ||
          null,
        requesterEmail: getRequestEmail(row),
        requesterCompanyName: profile?.company_name?.trim() || null,
        requesterPhone:
          requestContact.contactPhone ||
          getRequestPhone(row) ||
          profile?.phone?.trim() ||
          null,
        locationCount: requestProjectLocations.length,
        locationNames,
      }
    }),
    totalCount: count ?? 0,
  }
}

export async function getPendingRequestsCount(): Promise<number> {
  const supabase = getSupabaseClient()

  const { count, error } = await supabase
    .from('request_projects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

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

export async function createAdminManualLocationRequest(
  input: CreateAdminManualRequestInput,
): Promise<string> {
  const title = input.title.trim()
  const contactName = input.contactName.trim()
  const contactEmail = input.contactEmail.trim()
  const contactPhone = input.contactPhone.trim()
  const locationIds = Array.from(
    new Set(input.locationIds.map((locationId) => locationId.trim()).filter(Boolean)),
  )

  if (!input.userId.trim()) {
    throw new Error('No encontramos el usuario autenticado para crear la solicitud.')
  }

  if (!title) {
    throw new Error('Ingresá un producto para crear la solicitud.')
  }

  if (!contactName || !contactEmail || !contactPhone) {
    throw new Error('Completá nombre, email y teléfono del contacto.')
  }

  if (locationIds.length === 0) {
    throw new Error('Seleccioná al menos una locación.')
  }

  if (
    input.tentativeStartDate &&
    input.tentativeEndDate &&
    input.tentativeEndDate < input.tentativeStartDate
  ) {
    throw new Error('La fecha tentativa de fin no puede ser anterior al inicio.')
  }

  const supabase = getSupabaseClient()
  const message = buildRequestProjectMessageWithContactMetadata({
    contactName,
    contactEmail,
    contactPhone,
    notes: input.message,
  })
  const productionCompany = normalizeNullableString(input.productionCompany)
  const tentativeStartDate = normalizeNullableDate(input.tentativeStartDate)
  const tentativeEndDate = normalizeNullableDate(input.tentativeEndDate)
  const now = new Date().toISOString()

  const { data: locationRowsData, error: locationsError } = await supabase
    .from('locations')
    .select('id, title, location_code')
    .in('id', locationIds)

  if (locationsError) {
    throw new Error(locationsError.message)
  }

  const locationRows = (locationRowsData ?? []) as ManualRequestLocationRow[]
  const locationsById = new Map(locationRows.map((row) => [row.id, row]))

  if (locationsById.size !== locationIds.length) {
    throw new Error('No pudimos resolver una o más locaciones seleccionadas.')
  }

  const snapshotLocations = locationIds.map((locationId) => {
    const location = locationsById.get(locationId)

    return {
      locationId,
      title: location?.title?.trim() || null,
    }
  })

  let createdRequestId: string | null = null

  try {
    const { data: requestProjectData, error: requestProjectError } = await supabase
      .from('request_projects')
      .insert({
        user_id: input.userId.trim(),
        title,
        production_company: productionCompany,
        message,
        status: 'draft',
        tentative_start_date: tentativeStartDate,
        tentative_end_date: tentativeEndDate,
        has_unsubmitted_changes: false,
        latest_version_number: 1,
      })
      .select('id')
      .single()

    if (requestProjectError) {
      throw new Error(requestProjectError.message)
    }

    if (!requestProjectData?.id) {
      throw new Error('No recibimos la solicitud creada.')
    }

    createdRequestId = requestProjectData.id

    const requestProjectLocationRows = locationIds.map((locationId, index) => {
      const location = locationsById.get(locationId)

      return {
        request_project_id: createdRequestId,
        location_id: locationId,
        sort_order: index,
        status: 'pending',
        location_code_snapshot: location?.location_code?.trim() || null,
        location_title_snapshot: location?.title?.trim() || null,
      }
    })

    const { error: requestProjectLocationsError } = await supabase
      .from('request_project_locations')
      .insert(requestProjectLocationRows)

    if (requestProjectLocationsError) {
      throw new Error(requestProjectLocationsError.message)
    }

    const { data: requestProjectVersionData, error: requestProjectVersionError } = await supabase
      .from('request_project_versions')
      .insert({
        request_project_id: createdRequestId,
        version_number: 1,
        status: 'submitted',
        title,
        production_company: productionCompany,
        message,
        tentative_start_date: tentativeStartDate,
        tentative_end_date: tentativeEndDate,
        snapshot_payload: {
          locations: snapshotLocations,
        },
        created_by: input.userId.trim(),
      })
      .select('id')
      .single()

    if (requestProjectVersionError) {
      throw new Error(requestProjectVersionError.message)
    }

    if (!requestProjectVersionData?.id) {
      throw new Error('No recibimos la versión inicial de la solicitud.')
    }

    const { error: submitRequestProjectError } = await supabase
      .from('request_projects')
      .update({
        status: 'pending',
        submitted_at: now,
        updated_at: now,
        latest_version_number: 1,
        admin_active_version_id: requestProjectVersionData.id,
      })
      .eq('id', createdRequestId)

    if (submitRequestProjectError) {
      throw new Error(submitRequestProjectError.message)
    }

    if (!createdRequestId) {
      throw new Error('No recibimos el identificador de la solicitud creada.')
    }

    return createdRequestId
  } catch (error) {
    if (createdRequestId) {
      await supabase
        .from('request_projects')
        .delete()
        .eq('id', createdRequestId)
        .eq('status', 'draft')
    }

    throw error
  }
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

export async function updateRequestProjectLocationStatus(input: {
  requestProjectVersionId: string
  locationId: string
  status: RequestProjectLocationStatus
}): Promise<{
  requestProjectVersionId: string
  locationId: string
  status: RequestProjectLocationStatus
}> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_project_version_location_statuses')
    .upsert(
      {
        request_project_version_id: input.requestProjectVersionId,
        location_id: input.locationId,
        status: input.status,
      },
      {
        onConflict: 'request_project_version_id,location_id',
      },
    )
    .select('request_project_version_id, location_id, status')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (
    !data?.request_project_version_id ||
    !data.location_id ||
    typeof data.status !== 'string'
  ) {
    throw new Error('No recibimos confirmación al actualizar el estado de la locación.')
  }

  return {
    requestProjectVersionId: data.request_project_version_id,
    locationId: data.location_id,
    status: normalizeRequestProjectLocationStatus(data.status),
  }
}

export async function setAdminLocationRequestActiveVersion(input: {
  requestId: string
  requestProjectVersionId: string
}): Promise<string> {
  const supabase = getSupabaseClient()

  const { data: versionData, error: versionError } = await supabase
    .from('request_project_versions')
    .select('id')
    .eq('id', input.requestProjectVersionId)
    .eq('request_project_id', input.requestId)
    .maybeSingle()

  if (versionError) {
    throw new Error(versionError.message)
  }

  if (!versionData?.id) {
    throw new Error('La versión seleccionada no pertenece a esta solicitud.')
  }

  await persistAdminActiveVersionId(input)

  return versionData.id
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

export async function getActiveAdminLocationRequestReservations(
  requestId: string,
): Promise<{
  count: number
  reservationIds: string[]
}> {
  const supabase = getSupabaseClient()

  const { data: requestProjectLocationsData, error: requestProjectLocationsError } = await supabase
    .from('request_project_locations')
    .select('id')
    .eq('request_project_id', requestId)

  if (requestProjectLocationsError) {
    throw new Error(requestProjectLocationsError.message)
  }

  const requestProjectLocationIds = getUniqueValues(
    ((requestProjectLocationsData ?? []) as Array<{ id: string | null }>).map((row) => row.id),
  )

  if (requestProjectLocationIds.length === 0) {
    return {
      count: 0,
      reservationIds: [],
    }
  }

  const { data: reservationsData, error: reservationsError } = await supabase
    .from('reservations')
    .select('id, status')
    .in('request_project_location_id', requestProjectLocationIds)

  if (reservationsError) {
    throw new Error(reservationsError.message)
  }

  const reservationRows = (reservationsData ?? []) as Array<{
    id: string | null
    status: string | null
  }>
  const reservationIds = getUniqueValues(
    reservationRows.map((row) => row.id),
  )
  const count = reservationRows.filter(
    (row) => row.status === 'pending' || row.status === 'confirmed',
  ).length

  return {
    count,
    reservationIds,
  }
}

export async function getAdminLocationRequestById(
  requestId: string,
): Promise<AdminLocationRequestDetail> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_projects')
    .select('*')
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

  const versions = await getVersionsByRequestId(requestId)
  const latestVersion = versions[0] ?? null
  const persistedActiveVersionId =
    typeof row.admin_active_version_id === 'string' && row.admin_active_version_id.trim()
      ? row.admin_active_version_id.trim()
      : null
  const activeVersionFromPersistence =
    persistedActiveVersionId
      ? versions.find((version) => version.id === persistedActiveVersionId) ?? null
      : null
  const activeVersion = activeVersionFromPersistence ?? latestVersion

  if (
    latestVersion &&
    hasAdminActiveVersionColumn(row) &&
    (!persistedActiveVersionId || !activeVersionFromPersistence)
  ) {
    await persistAdminActiveVersionId({
      requestId,
      requestProjectVersionId: latestVersion.id,
    })
    row.admin_active_version_id = latestVersion.id
  }

  const requestProjectLocations = await getRequestProjectLocationsByRequestId(requestId)
  const locationIds = requestProjectLocations.map((location) => location.location_id)
  const [locationsById, statusesByLocationId] = await Promise.all([
    getLocationsById(locationIds),
    activeVersion
      ? getVersionLocationStatusesByLocationId(activeVersion.id, locationIds)
      : Promise.resolve(new Map<string, RequestProjectLocationStatus>()),
  ])
  const reservationsByRequestProjectLocationId =
    await getReservationsByRequestProjectLocationId(
      requestProjectLocations.map((location) => location.id),
    )

  const locations = requestProjectLocations.map((requestProjectLocation) =>
    mapRequestProjectLocationToDetail({
      currentLocation: locationsById.get(requestProjectLocation.location_id) ?? null,
      legacyLocation: requestProjectLocation,
      linkedReservation:
        reservationsByRequestProjectLocationId.get(requestProjectLocation.id) ?? null,
      requestProjectVersionId: activeVersion?.id ?? '',
      statusByLocationId: statusesByLocationId,
    }),
  )

  const title = row.title?.trim()
  const requestContact = parseRequestProjectMessageWithContactMetadata(row.message)

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
    message: requestContact.notes,
    status: normalizeLocationRequestStatus(row.status),
    createdAt: row.created_at,
    submittedAt: getCanonicalSubmittedAt(row),
    updatedAt: row.updated_at,
    requester: {
      userId: row.user_id,
      fullName:
        requestContact.contactName ||
        getRequestFullName(row) ||
        profile?.full_name?.trim() ||
        null,
      email:
        requestContact.contactEmail ||
        getRequestEmail(row) ||
        profile?.email?.trim() ||
        null,
      phone:
        requestContact.contactPhone ||
        getRequestPhone(row) ||
        profile?.phone?.trim() ||
        null,
    },
    activeVersionId: activeVersion?.id ?? null,
    activeVersionNumber:
      typeof activeVersion?.version_number === 'number' && Number.isFinite(activeVersion.version_number)
        ? activeVersion.version_number
        : null,
    latestVersionId: latestVersion?.id ?? null,
    latestVersionNumber:
      typeof latestVersion?.version_number === 'number' && Number.isFinite(latestVersion.version_number)
        ? latestVersion.version_number
        : null,
    hasNewerVersion:
      typeof latestVersion?.version_number === 'number' &&
      Number.isFinite(latestVersion.version_number) &&
      typeof activeVersion?.version_number === 'number' &&
      Number.isFinite(activeVersion.version_number) &&
      latestVersion.version_number > activeVersion.version_number,
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
    officialPdf:
      getRequestProjectOfficialPdf(activeVersion) ??
      (activeVersion?.id && latestVersion?.id && activeVersion.id === latestVersion.id
        ? getRequestProjectOfficialPdf(row)
        : null),
    versions: mapRequestProjectVersions({
      activeVersionId: activeVersion?.id ?? null,
      latestVersionId: latestVersion?.id ?? null,
      versions,
    }),
    locations,
  }
}
