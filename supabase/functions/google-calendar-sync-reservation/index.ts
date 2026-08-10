import { assertAdmin } from '../_shared/auth.ts'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getActiveGoogleCalendarConnection,
  getGoogleCalendarEvent,
  refreshGoogleCalendarAccessToken,
  searchGoogleCalendarEventsByReservationId,
  updateGoogleCalendarEvent,
} from '../_shared/google-calendar.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
  logInternalError,
} from '../_shared/http.ts'

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

type LocationRelation =
  | {
      address_public: string | null
      location_code: string | null
      title: string | null
      owners: OwnerRelation
    }
  | Array<{
      address_public: string | null
      location_code: string | null
      title: string | null
      owners: OwnerRelation
    }>
  | null

type OwnerRelation =
  | {
      full_name: string | null
      phone: string | null
    }
  | Array<{
      full_name: string | null
      phone: string | null
    }>
  | null

type RequestProjectRelation =
  | {
      production_company: string | null
      title: string | null
      user_id: string | null
    }
  | Array<{
      production_company: string | null
      title: string | null
      user_id: string | null
    }>
  | null

type RequestProjectLocationRelation =
  | {
      request_project_id: string | null
      request_projects: RequestProjectRelation
    }
  | Array<{
      request_project_id: string | null
      request_projects: RequestProjectRelation
    }>
  | null

type RequesterProfileRow = {
  email: string | null
  full_name: string | null
  phone: string | null
}

type ReservationBaseRow = {
  ends_at: string
  google_event_id: string | null
  id: string
  location_id: string
  request_project_location_id: string | null
  starts_at: string
  status: ReservationStatus
  title: string
}

type LocationRow = {
  address_public: string | null
  location_code: string | null
  owners: OwnerRelation
  title: string | null
}

type RequestProjectLocationRow = {
  request_project_id: string | null
}

type RequestProjectRow = {
  production_company: string | null
  title: string | null
  user_id: string | null
}

type ReservationRow = {
  ends_at: string
  google_event_id: string | null
  id: string
  location_id: string
  locations: LocationRelation
  request_project_location_id: string | null
  request_project_locations: RequestProjectLocationRelation
  starts_at: string
  status: ReservationStatus
  title: string
}

type ReservationSyncStatus = 'not_applicable' | 'pending' | 'synced' | 'error'

const GOOGLE_CALENDAR_TIME_ZONE = 'America/Montevideo'
const GENERIC_SYNC_ERROR_MESSAGE = 'Could not synchronize reservation with Google Calendar.'

function getLocationRelation(relation: LocationRelation) {
  if (!relation) {
    return null
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function getOwnerRelation(relation: OwnerRelation) {
  if (!relation) {
    return null
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function getRequestProjectLocationRelation(relation: RequestProjectLocationRelation) {
  if (!relation) {
    return null
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function getRequestProjectRelation(relation: RequestProjectRelation) {
  if (!relation) {
    return null
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function getLineValue(value: string | null | undefined) {
  return value?.trim() || ''
}

function buildGoogleCalendarEventDescription(
  reservation: ReservationRow,
  requesterProfile: RequesterProfileRow | null,
) {
  const location = getLocationRelation(reservation.locations)
  const owner = getOwnerRelation(location?.owners ?? null)
  const requestProjectLocation = getRequestProjectLocationRelation(
    reservation.request_project_locations,
  )
  const requestProject = getRequestProjectRelation(
    requestProjectLocation?.request_projects ?? null,
  )

  return [
    'LOCACIÓN',
    '',
    `Código: ${getLineValue(location?.location_code)}`,
    `Nombre: ${getLineValue(location?.title)}`,
    '',
    'PROPIETARIO',
    '',
    getLineValue(owner?.full_name),
    getLineValue(owner?.phone),
    '',
    'SOLICITUD',
    '',
    `Producto: ${getLineValue(requestProject?.title)}`,
    `Productora: ${getLineValue(requestProject?.production_company)}`,
    '',
    'SOLICITANTE',
    '',
    getLineValue(requesterProfile?.full_name),
    getLineValue(requesterProfile?.phone),
    getLineValue(requesterProfile?.email),
  ].join('\n')
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function sanitizeSyncErrorMessage(error: unknown) {
  if (error instanceof HttpError && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return GENERIC_SYNC_ERROR_MESSAGE
}

function isRecoverableSyncError(error: unknown) {
  return (
    error instanceof HttpError &&
    (error.status === 409 || error.status === 500 || error.status === 502 || error.status === 503)
  )
}

async function loadRequesterProfile(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  requesterUserId: string | null,
) {
  const normalizedUserId = requesterUserId?.trim() || ''

  if (!normalizedUserId) {
    return null
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('full_name, phone, email')
    .eq('user_id', normalizedUserId)
    .maybeSingle()

  if (error) {
    logInternalError(
      '[google-calendar-sync-reservation] requester_profile_select_failed',
      'profiles.select_requester',
      error,
    )
    throw new HttpError(500, 'Could not load the requester profile for Google Calendar sync.')
  }

  return (data ?? null) as RequesterProfileRow | null
}

async function buildGoogleCalendarEventInput(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  reservation: ReservationRow,
) {
  const location = getLocationRelation(reservation.locations)
  const requestProjectLocation = getRequestProjectLocationRelation(
    reservation.request_project_locations,
  )
  const requestProject = getRequestProjectRelation(
    requestProjectLocation?.request_projects ?? null,
  )
  const requesterProfile = await loadRequesterProfile(
    adminClient,
    requestProject?.user_id?.trim() || null,
  )

  if (!location?.title?.trim()) {
    throw new HttpError(500, 'The reservation location is missing a public title.')
  }

  return {
    description: buildGoogleCalendarEventDescription(reservation, requesterProfile),
    endsAt: reservation.ends_at,
    location: location.address_public?.trim() || null,
    reservationId: reservation.id,
    startsAt: reservation.starts_at,
    summary: `${reservation.title.trim()} · ${location.title.trim()}`,
    timeZone: GOOGLE_CALENDAR_TIME_ZONE,
  }
}

async function parseBody(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON body.')
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('reservationId' in body) ||
    typeof body.reservationId !== 'string'
  ) {
    throw new HttpError(400, 'reservationId is required.')
  }

  const reservationId = body.reservationId.trim()

  if (!isUuid(reservationId)) {
    throw new HttpError(400, 'reservationId must be a valid UUID.')
  }

  return {
    reservationId,
  }
}

async function loadReservation(adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never, reservationId: string) {
  const { data: reservationData, error: reservationError } = await adminClient
    .from('reservations')
    .select(
      `
        id,
        location_id,
        request_project_location_id,
        title,
        starts_at,
        ends_at,
        status,
        google_event_id
      `,
    )
    .eq('id', reservationId)
    .maybeSingle()

  if (reservationError) {
    logInternalError(
      '[google-calendar-sync-reservation] reservation_select_failed',
      'reservations.select_base_for_sync',
      reservationError,
    )
    console.error('[google-calendar-sync-reservation] reservation_select_failed_raw', {
      code: reservationError.code,
      details: reservationError.details,
      hint: reservationError.hint,
      message: reservationError.message,
    })
    throw new HttpError(500, 'Could not load the reservation for Google Calendar sync.')
  }

  if (!reservationData) {
    throw new HttpError(404, 'Reservation not found.')
  }

  const reservation = reservationData as ReservationBaseRow
  const { data: locationData, error: locationError } = await adminClient
    .from('locations')
    .select(
      `
        title,
        location_code,
        address_public,
        owners(
          full_name,
          phone
        )
      `,
    )
    .eq('id', reservation.location_id)
    .maybeSingle()

  if (locationError) {
    logInternalError(
      '[google-calendar-sync-reservation] reservation_select_failed',
      'locations.select_for_reservation_sync',
      locationError,
    )
    console.error('[google-calendar-sync-reservation] location_select_failed_raw', {
      code: locationError.code,
      details: locationError.details,
      hint: locationError.hint,
      message: locationError.message,
    })
    throw new HttpError(500, 'Could not load the reservation for Google Calendar sync.')
  }

  const location = (locationData ?? null) as LocationRow | null

  if (!location) {
    throw new HttpError(500, 'Could not load the reservation location for Google Calendar sync.')
  }

  let requestProjectLocation: RequestProjectLocationRelation = null

  if (reservation.request_project_location_id?.trim()) {
    const { data: requestProjectLocationData, error: requestProjectLocationError } = await adminClient
      .from('request_project_locations')
      .select('request_project_id')
      .eq('id', reservation.request_project_location_id.trim())
      .maybeSingle()

    if (requestProjectLocationError) {
      logInternalError(
        '[google-calendar-sync-reservation] reservation_select_failed',
        'request_project_locations.select_for_reservation_sync',
        requestProjectLocationError,
      )
      console.error('[google-calendar-sync-reservation] request_project_location_select_failed_raw', {
        code: requestProjectLocationError.code,
        details: requestProjectLocationError.details,
        hint: requestProjectLocationError.hint,
        message: requestProjectLocationError.message,
      })
      throw new HttpError(500, 'Could not load the reservation for Google Calendar sync.')
    }

    const requestProjectLocationRow =
      (requestProjectLocationData ?? null) as RequestProjectLocationRow | null

    let requestProject: RequestProjectRelation = null

    if (requestProjectLocationRow?.request_project_id?.trim()) {
      const { data: requestProjectData, error: requestProjectError } = await adminClient
        .from('request_projects')
        .select('title, production_company, user_id')
        .eq('id', requestProjectLocationRow.request_project_id.trim())
        .maybeSingle()

      if (requestProjectError) {
        logInternalError(
          '[google-calendar-sync-reservation] reservation_select_failed',
          'request_projects.select_for_reservation_sync',
          requestProjectError,
        )
        console.error('[google-calendar-sync-reservation] request_project_select_failed_raw', {
          code: requestProjectError.code,
          details: requestProjectError.details,
          hint: requestProjectError.hint,
          message: requestProjectError.message,
        })
        throw new HttpError(500, 'Could not load the reservation for Google Calendar sync.')
      }

      requestProject = (requestProjectData ?? null) as RequestProjectRow | null
    }

    requestProjectLocation = {
      request_project_id: requestProjectLocationRow?.request_project_id ?? null,
      request_projects: requestProject,
    }
  }

  return {
    ...reservation,
    locations: location,
    request_project_locations: requestProjectLocation,
  }
}

async function updateReservationSyncState(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  reservationId: string,
  values: {
    google_event_id?: string | null
    google_sync_error?: string | null
    google_sync_status?: ReservationSyncStatus
    google_synced_at?: string | null
  },
) {
  const { error } = await adminClient
    .from('reservations')
    .update(values)
    .eq('id', reservationId)

  if (error) {
    logInternalError(
      '[google-calendar-sync-reservation] reservation_sync_update_failed',
      'reservations.update_sync_fields',
      error,
    )
    throw new HttpError(500, 'Could not persist the Google Calendar sync state.')
  }
}

async function persistRecoverableSyncError(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  reservationId: string,
  error: unknown,
) {
  try {
    await updateReservationSyncState(adminClient, reservationId, {
      google_sync_error: sanitizeSyncErrorMessage(error),
      google_sync_status: 'error',
    })
  } catch (persistError) {
    logInternalError(
      '[google-calendar-sync-reservation] reservation_sync_error_persist_failed',
      'reservations.update_sync_error',
      persistError,
    )
  }
}

async function findSingleGoogleCalendarEvent(
  accessToken: string,
  reservationId: string,
) {
  const matches = await searchGoogleCalendarEventsByReservationId(accessToken, reservationId)

  if (matches.length > 1) {
    throw new HttpError(
      409,
      'Multiple Google Calendar events match this reservation.',
    )
  }

  return matches[0] ?? null
}

async function syncConfirmedReservation(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  reservation: ReservationRow,
) {
  const connection = await getActiveGoogleCalendarConnection(adminClient)
  const { accessToken } = await refreshGoogleCalendarAccessToken(connection.refreshToken)
  const eventInput = await buildGoogleCalendarEventInput(adminClient, reservation)
  let resolvedEventId = reservation.google_event_id?.trim() || null

  if (resolvedEventId) {
    const existingEvent = await getGoogleCalendarEvent(accessToken, resolvedEventId)

    if (!existingEvent) {
      const matchedEvent = await findSingleGoogleCalendarEvent(accessToken, reservation.id)
      resolvedEventId = matchedEvent?.id ?? null
    }
  } else {
    const matchedEvent = await findSingleGoogleCalendarEvent(accessToken, reservation.id)
    resolvedEventId = matchedEvent?.id ?? null
  }

  const syncedEvent = resolvedEventId
    ? await updateGoogleCalendarEvent(accessToken, resolvedEventId, eventInput)
    : await createGoogleCalendarEvent(accessToken, eventInput)

  const finalEvent = syncedEvent
    ?? await createGoogleCalendarEvent(accessToken, eventInput)
  const syncedAt = new Date().toISOString()

  await updateReservationSyncState(adminClient, reservation.id, {
    google_event_id: finalEvent.id,
    google_sync_error: null,
    google_sync_status: 'synced',
    google_synced_at: syncedAt,
  })

  return jsonResponse({
    googleEventId: finalEvent.id,
    googleSyncStatus: 'synced',
    googleSyncedAt: syncedAt,
    reservationId: reservation.id,
    status: 'synced',
  }, { status: 200 })
}

async function syncInactiveReservation(
  adminClient: ReturnType<typeof assertAdmin> extends Promise<infer T> ? T['adminClient'] : never,
  reservation: ReservationRow,
) {
  const currentEventId = reservation.google_event_id?.trim() || null
  const connection = await getActiveGoogleCalendarConnection(adminClient)
  const { accessToken } = await refreshGoogleCalendarAccessToken(connection.refreshToken)
  let deletedCurrentEvent = false

  if (currentEventId) {
    deletedCurrentEvent = await deleteGoogleCalendarEvent(accessToken, currentEventId)
  }

  if (!deletedCurrentEvent) {
    let matchedEvent: Awaited<ReturnType<typeof findSingleGoogleCalendarEvent>> | null = null

    try {
      matchedEvent = await findSingleGoogleCalendarEvent(accessToken, reservation.id)
    } catch (error) {
      logInternalError(
        '[google-calendar-sync-reservation] inactive_event_lookup_failed',
        'google_calendar.find_event_by_reservation_id',
        error,
      )
      throw error
    }

    if (matchedEvent) {
      try {
        await deleteGoogleCalendarEvent(accessToken, matchedEvent.id)
      } catch (error) {
        logInternalError(
          '[google-calendar-sync-reservation] inactive_event_delete_failed',
          'google_calendar.delete_event_by_reservation_id',
          error,
        )
        throw error
      }
    }
  }

  const syncedAt = new Date().toISOString()

  await updateReservationSyncState(adminClient, reservation.id, {
    google_event_id: null,
    google_sync_error: null,
    google_sync_status: 'not_applicable',
    google_synced_at: syncedAt,
  })

  return jsonResponse({
    googleEventId: null,
    googleSyncStatus: 'not_applicable',
    googleSyncedAt: syncedAt,
    reservationId: reservation.id,
    status: 'deleted',
  }, { status: 200 })
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      { status: 405 },
      origin,
    )
  }

  let adminClient: Awaited<ReturnType<typeof assertAdmin>>['adminClient'] | null = null
  let reservationId: string | null = null

  try {
    const authContext = await assertAdmin(request)
    adminClient = authContext.adminClient

    const parsedBody = await parseBody(request)
    reservationId = parsedBody.reservationId

    const reservation = await loadReservation(adminClient, reservationId)

    if (reservation.status === 'confirmed') {
      return await syncConfirmedReservation(adminClient, reservation)
    }

    return await syncInactiveReservation(adminClient, reservation)
  } catch (error) {
    if (adminClient && reservationId && isRecoverableSyncError(error)) {
      await persistRecoverableSyncError(adminClient, reservationId, error)
    }

    logInternalError(
      '[google-calendar-sync-reservation] request_failed',
      'request',
      error,
    )

    if (
      error instanceof HttpError &&
      (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      return errorResponse(error, origin)
    }

    const status =
      error instanceof HttpError && error.status >= 400 && error.status < 600
        ? error.status
        : 500

    return jsonResponse(
      {
        message: GENERIC_SYNC_ERROR_MESSAGE,
        recoverable: true,
        status: 'error',
      },
      { status },
      origin,
    )
  }
})
