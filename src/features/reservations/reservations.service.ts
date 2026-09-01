import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
  getSupabaseSessionAccessToken,
} from '../../lib/supabase'
import {
  updateRequestProjectLocationStatus,
} from '../requests-admin/admin-location-requests.service'
import type { RequestProjectLocationStatus } from '../requests-admin/admin-location-requests.types'
import { parseRequestProjectMessageWithContactMetadata } from '../requests-admin/request-project-contact'
import type {
  ReservationCreatePayload,
  ReservationListItem,
  ReservationStatus,
  ReservationUpdatePayload,
} from './reservations.types'

type OwnerRelation =
  | {
      full_name: string | null
      phone: string | null
      email: string | null
    }
  | {
      full_name: string | null
      phone: string | null
      email: string | null
    }[]
  | null

type LocationImageRelation =
  | {
      url: string | null
      is_cover: boolean | null
    }[]
  | null

type LocationRelation =
  | {
      title: string | null
      location_code: string | null
      formatted_address: string | null
      location_images: LocationImageRelation
      owners: OwnerRelation
    }
  | {
      title: string | null
      location_code: string | null
      formatted_address: string | null
      location_images: LocationImageRelation
      owners: OwnerRelation
    }[]
  | null

type RequestProjectRelation =
  | {
      id?: string | null
      title: string | null
      production_company?: string | null
      message?: string | null
      user_id?: string | null
    }
  | {
      id?: string | null
      title: string | null
      production_company?: string | null
      message?: string | null
      user_id?: string | null
    }[]
  | null

type RequestProjectLocationRelation =
  | {
      request_project_id: string | null
      request_projects: RequestProjectRelation
    }
  | {
      request_project_id: string | null
      request_projects: RequestProjectRelation
    }[]
  | null

type ReservationRow = {
  id: string
  location_id: string
  request_project_location_id: string | null
  title: string
  production_company: string | null
  starts_at: string
  ends_at: string
  status: ReservationStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  locations: LocationRelation
  request_project_locations: RequestProjectLocationRelation
}

type ProfileRow = {
  user_id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type ReservationIdRow = {
  id: string
}

type ReservationEditableRow = {
  id: string
  location_id: string
  request_project_location_id?: string | null
  title: string
  production_company?: string | null
  starts_at: string
  ends_at: string
  status: ReservationStatus
  notes: string | null
}

type RequestProjectLocationSyncRow = {
  location_id: string | null
  request_project_id: string | null
}

type RequestProjectAdminVersionRow = {
  admin_active_version_id?: string | null
}

type RequestProjectVersionSyncRow = {
  id: string
}

type GoogleCalendarSyncInput = {
  action?: 'sync' | 'cleanup'
  reservationId: string
}

type GoogleCalendarSyncOptions = {
  throwOnError?: boolean
}

type ReservationSaveResult = {
  id: string
  syncWarning: string | null
}

const GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE =
  'Reserva guardada, pero no se pudo sincronizar con Google Calendar.'
const GOOGLE_CALENDAR_DELETE_SYNC_ERROR_MESSAGE =
  'No pudimos eliminar la reserva porque no se pudo limpiar Google Calendar. La reserva quedó cancelada para que puedas reintentar.'
const REQUEST_LOCATION_STATUS_SYNC_WARNING_MESSAGE =
  'La reserva se guardó, pero no pudimos sincronizar el estado de la locación en la solicitud.'

function getLocationRelation(relation: LocationRelation) {
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

function getRequestProjectLocationRelation(relation: RequestProjectLocationRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation
}

function getRequestProjectRelation(relation: RequestProjectRelation) {
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

function mapReservationStatusToRequestProjectLocationStatus(
  status: ReservationStatus,
): RequestProjectLocationStatus {
  if (status === 'confirmed' || status === 'cancelled') {
    return status
  }

  return 'pending'
}

function mergeReservationWarnings(...warnings: Array<string | null | undefined>) {
  const normalizedWarnings = warnings
    .map((warning) => warning?.trim() || '')
    .filter((warning) => warning.length > 0)

  return normalizedWarnings.length > 0 ? normalizedWarnings.join(' ') : null
}

function mapReservation(
  row: ReservationRow,
  profilesByUserId: Map<string, ProfileRow>,
): ReservationListItem {
  const location = getLocationRelation(row.locations)
  const owner = location ? getOwnerRelation(location.owners) : null
  const requestProjectLocation = getRequestProjectLocationRelation(
    row.request_project_locations,
  )
  const requestProject = getRequestProjectRelation(
    requestProjectLocation?.request_projects ?? null,
  )
  const requestContact = parseRequestProjectMessageWithContactMetadata(
    requestProject?.message ?? null,
  )
  const requesterUserId = requestProject?.user_id?.trim() || null
  const requesterProfile =
    requesterUserId ? profilesByUserId.get(requesterUserId) ?? null : null

  return {
    id: row.id,
    locationId: row.location_id,
    requestProjectLocationId: row.request_project_location_id,
    requestProjectId: requestProjectLocation?.request_project_id?.trim() || null,
    productionCompany:
      row.production_company?.trim() ||
      requestProject?.production_company?.trim() ||
      null,
    requestProjectTitle: requestProject?.title?.trim() || null,
    requestProductionCompany:
      requestProject?.production_company?.trim() ||
      row.production_company?.trim() ||
      null,
    requestRequesterFullName:
      requestContact.contactName ||
      requesterProfile?.full_name?.trim() ||
      null,
    requestRequesterEmail:
      requestContact.contactEmail ||
      requesterProfile?.email?.trim() ||
      null,
    requestRequesterPhone:
      requestContact.contactPhone ||
      requesterProfile?.phone?.trim() ||
      null,
    locationTitle: location?.title?.trim() || 'Locación sin título',
    locationCode: location?.location_code?.trim() || null,
    formattedAddress: location?.formatted_address?.trim() || null,
    coverImageUrl: getCoverImageUrl(location?.location_images ?? null),
    ownerName: owner?.full_name?.trim() || null,
    ownerPhone: owner?.phone?.trim() || null,
    ownerEmail: owner?.email?.trim() || null,
    title: row.title.trim(),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    notes: row.notes?.trim() || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context

    try {
      const payload = await response.json()

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message.trim()
      ) {
        return payload.message
      }

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string' &&
        payload.error.trim()
      ) {
        return payload.error
      }
    } catch {
      try {
        const text = await response.text()

        if (text.trim().length > 0) {
          return text
        }
      } catch {
        return fallbackMessage
      }
    }

    return fallbackMessage
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

async function syncReservationWithGoogleCalendar(
  input: GoogleCalendarSyncInput,
  options: GoogleCalendarSyncOptions = {},
): Promise<string | null> {
  const supabase = getSupabaseClient()
  const accessToken = await getSupabaseSessionAccessToken()
  const { throwOnError = false } = options

  const { error } = await supabase.functions.invoke('google-calendar-sync-reservation', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      ...(input.action ? { action: input.action } : {}),
      reservationId: input.reservationId,
    },
  })

  if (!error) {
    return null
  }

  const syncErrorMessage = await getEdgeFunctionErrorMessage(
    error,
    GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE,
  )

  if (throwOnError) {
    throw new Error(syncErrorMessage)
  }

  return syncErrorMessage.trim()
    ? `${GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE} ${syncErrorMessage.trim()}`
    : GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE
}

export async function syncExistingReservation(
  reservationId: string,
): Promise<ReservationSaveResult> {
  const normalizedReservationId = reservationId.trim()

  if (!normalizedReservationId) {
    throw new Error('No encontramos la reserva que querés sincronizar.')
  }

  return {
    id: normalizedReservationId,
    syncWarning: await syncReservationWithGoogleCalendar({
      action: 'sync',
      reservationId: normalizedReservationId,
    }),
  }
}

async function syncRequestProjectLocationStatusFromReservation(input: {
  requestProjectLocationId: string | null
  reservationStatus: ReservationStatus
}): Promise<string | null> {
  const requestProjectLocationId = input.requestProjectLocationId?.trim() || ''

  if (!requestProjectLocationId) {
    return null
  }

  const supabase = getSupabaseClient()

  try {
    const { data: requestProjectLocationData, error: requestProjectLocationError } = await supabase
      .from('request_project_locations')
      .select('request_project_id, location_id')
      .eq('id', requestProjectLocationId)
      .maybeSingle()

    if (requestProjectLocationError) {
      throw new Error(requestProjectLocationError.message)
    }

    const requestProjectLocation =
      (requestProjectLocationData ?? null) as RequestProjectLocationSyncRow | null

    if (
      !requestProjectLocation?.request_project_id?.trim() ||
      !requestProjectLocation.location_id?.trim()
    ) {
      return `${REQUEST_LOCATION_STATUS_SYNC_WARNING_MESSAGE} No pudimos resolver la solicitud o la locación vinculada.`
    }

    const { data: requestProjectData, error: requestProjectError } = await supabase
      .from('request_projects')
      .select('admin_active_version_id')
      .eq('id', requestProjectLocation.request_project_id.trim())
      .maybeSingle()

    if (requestProjectError) {
      throw new Error(requestProjectError.message)
    }

    const requestProject = (requestProjectData ?? null) as RequestProjectAdminVersionRow | null
    const persistedActiveVersionId = requestProject?.admin_active_version_id?.trim() || null

    const { data: versionRows, error: versionError } = await supabase
      .from('request_project_versions')
      .select('id')
      .eq('request_project_id', requestProjectLocation.request_project_id.trim())
      .order('version_number', { ascending: false })

    if (versionError) {
      throw new Error(versionError.message)
    }

    const versions = (versionRows ?? []) as RequestProjectVersionSyncRow[]
    const activeVersionId =
      (persistedActiveVersionId &&
      versions.find((version) => version.id === persistedActiveVersionId)?.id) ||
      versions[0]?.id ||
      null

    if (!activeVersionId) {
      return `${REQUEST_LOCATION_STATUS_SYNC_WARNING_MESSAGE} No encontramos una versión activa para la solicitud vinculada.`
    }

    await updateRequestProjectLocationStatus({
      requestProjectVersionId: activeVersionId,
      locationId: requestProjectLocation.location_id.trim(),
      status: mapReservationStatusToRequestProjectLocationStatus(input.reservationStatus),
    })

    return null
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null

    return errorMessage
      ? `${REQUEST_LOCATION_STATUS_SYNC_WARNING_MESSAGE} ${errorMessage}`
      : REQUEST_LOCATION_STATUS_SYNC_WARNING_MESSAGE
  }
}

export async function getReservations(): Promise<ReservationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
        id,
        location_id,
        request_project_location_id,
        title,
        production_company,
        starts_at,
        ends_at,
        status,
        notes,
        created_by,
        created_at,
        updated_at,
        locations(
          title,
          location_code,
          formatted_address,
          location_images(url, is_cover),
          owners(
            full_name,
            phone,
            email
          )
        ),
        request_project_locations(
          request_project_id,
          request_projects(
            id,
            title,
            production_company,
            message,
            user_id
          )
        )
      `,
    )
    .order('starts_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const reservationRows = (data ?? []) as ReservationRow[]
  const requesterUserIds = Array.from(
    new Set(
      reservationRows
        .map((row) =>
          getRequestProjectRelation(
            getRequestProjectLocationRelation(row.request_project_locations)?.request_projects ?? null,
          )?.user_id?.trim() || null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  )

  let profilesByUserId = new Map<string, ProfileRow>()

  if (requesterUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone')
      .in('user_id', requesterUserIds)

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    profilesByUserId = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    )
  }

  return reservationRows.map((row) => mapReservation(row, profilesByUserId))
}

export async function createReservation(
  payload: ReservationCreatePayload,
): Promise<ReservationSaveResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const id = (data as ReservationIdRow).id
  const googleCalendarSyncWarning = await syncReservationWithGoogleCalendar({ reservationId: id })
  const requestLocationStatusSyncWarning =
    await syncRequestProjectLocationStatusFromReservation({
      requestProjectLocationId: payload.request_project_location_id ?? null,
      reservationStatus: payload.status,
    })

  return {
    id,
    syncWarning: mergeReservationWarnings(
      googleCalendarSyncWarning,
      requestLocationStatusSyncWarning,
    ),
  }
}

export async function saveConfirmedReservation(input: {
  reservationId?: string | null
  locationId: string
  product: string
  productionCompany: string | null
  startsAt: string
  endsAt: string
  requestProjectLocationId?: string | null
}): Promise<ReservationSaveResult> {
  const supabase = getSupabaseClient()
  const reservationId = input.reservationId?.trim() || null
  const requestProjectLocationId =
    input.requestProjectLocationId === undefined
      ? undefined
      : input.requestProjectLocationId?.trim() || null

  const payload: ReservationUpdatePayload = {
    location_id: input.locationId,
    title: input.product.trim(),
    production_company: input.productionCompany?.trim() || null,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: 'confirmed',
    notes: null,
  }

  if (requestProjectLocationId !== undefined) {
    payload.request_project_location_id = requestProjectLocationId
  }

  if (reservationId) {
    return updateReservation(reservationId, payload)
  }

  if (requestProjectLocationId) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('request_project_location_id', requestProjectLocationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    const existingReservationId =
      (data as ReservationIdRow | null)?.id?.trim() || null

    if (existingReservationId) {
      return updateReservation(existingReservationId, payload)
    }
  }

  return createReservation(payload)
}

export async function updateReservation(
  id: string,
  payload: ReservationUpdatePayload,
): Promise<ReservationSaveResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .update(payload)
    .eq('id', id)
    .select('id, request_project_location_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const savedReservation = data as ReservationIdRow & {
    request_project_location_id?: string | null
  }
  const savedId = savedReservation.id
  const googleCalendarSyncWarning = await syncReservationWithGoogleCalendar({
    action: payload.status === 'confirmed' ? 'sync' : 'cleanup',
    reservationId: savedId,
  })
  const requestLocationStatusSyncWarning =
    await syncRequestProjectLocationStatusFromReservation({
      requestProjectLocationId: savedReservation.request_project_location_id ?? null,
      reservationStatus: payload.status,
    })

  return {
    id: savedId,
    syncWarning: mergeReservationWarnings(
      googleCalendarSyncWarning,
      requestLocationStatusSyncWarning,
    ),
  }
}

// Shared helper used outside the reservations module to confirm an existing
// reservation while preserving the same update + Google Calendar sync flow.
export async function confirmReservation(
  id: string,
): Promise<ReservationSaveResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .select('id, location_id, request_project_location_id, title, production_company, starts_at, ends_at, status, notes')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const reservation = data as ReservationEditableRow | null

  if (!reservation) {
    throw new Error('No encontramos la reserva que querés confirmar.')
  }

  if (reservation.status !== 'pending') {
    throw new Error('Solo se pueden confirmar reservas pendientes.')
  }

  return updateReservation(id, {
    location_id: reservation.location_id,
    title: reservation.title,
    production_company: reservation.production_company ?? null,
    starts_at: reservation.starts_at,
    ends_at: reservation.ends_at,
    status: 'confirmed',
    notes: reservation.notes,
  })
}

export async function cancelReservation(
  id: string,
): Promise<ReservationSaveResult> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .select('id, location_id, request_project_location_id, title, production_company, starts_at, ends_at, status, notes')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const reservation = data as ReservationEditableRow | null

  if (!reservation) {
    throw new Error('No encontramos la reserva que querés cancelar.')
  }

  return updateReservation(id, {
    location_id: reservation.location_id,
    title: reservation.title,
    production_company: reservation.production_company ?? null,
    starts_at: reservation.starts_at,
    ends_at: reservation.ends_at,
    status: 'cancelled',
    notes: reservation.notes,
  })
}

export async function deleteReservation(id: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('id, location_id, request_project_location_id, title, production_company, starts_at, ends_at, status, notes')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const reservation = data as ReservationEditableRow | null

  if (!reservation) {
    throw new Error('No encontramos la reserva que querés eliminar.')
  }

  try {
    await syncReservationWithGoogleCalendar(
      {
        action: 'cleanup',
        reservationId: reservation.id,
      },
      { throwOnError: true },
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : GOOGLE_CALENDAR_DELETE_SYNC_ERROR_MESSAGE

    throw new Error(
      `${GOOGLE_CALENDAR_DELETE_SYNC_ERROR_MESSAGE} ${errorMessage}`.trim(),
    )
  }

  const { data: deletedReservation, error: deleteError } = await supabase
    .from('reservations')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  const requestLocationStatusSyncWarning =
    await syncRequestProjectLocationStatusFromReservation({
      requestProjectLocationId: reservation.request_project_location_id ?? null,
      reservationStatus: 'cancelled',
    })

  if (requestLocationStatusSyncWarning) {
    console.warn(
      '[reservations.delete] request_project_location_sync_warning',
      {
        requestProjectLocationId: reservation.request_project_location_id ?? null,
        reservationId: reservation.id,
        warning: requestLocationStatusSyncWarning,
      },
    )
  }

  return (deletedReservation as ReservationIdRow).id
}
