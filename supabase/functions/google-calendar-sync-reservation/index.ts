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

type ReservationStatus = 'tentative' | 'confirmed' | 'cancelled'

type LocationRelation =
  | {
      address_public: string | null
      location_code: string | null
      title: string | null
    }
  | Array<{
      address_public: string | null
      location_code: string | null
      title: string | null
    }>
  | null

type ReservationRow = {
  ends_at: string
  google_event_id: string | null
  id: string
  location_id: string
  locations: LocationRelation
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

function buildGoogleCalendarEventDescription(
  reservationId: string,
  locationCode: string | null,
) {
  const lines = [
    'Reserva interna',
    `Reservation ID: ${reservationId}`,
  ]

  if (locationCode?.trim()) {
    lines.push(`Location code: ${locationCode.trim()}`)
  }

  return lines.join('\n')
}

function buildGoogleCalendarEventInput(reservation: ReservationRow) {
  const location = getLocationRelation(reservation.locations)

  if (!location?.title?.trim()) {
    throw new HttpError(500, 'The reservation location is missing a public title.')
  }

  return {
    description: buildGoogleCalendarEventDescription(
      reservation.id,
      location.location_code?.trim() || null,
    ),
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
  const { data, error } = await adminClient
    .from('reservations')
    .select(
      `
        id,
        location_id,
        title,
        starts_at,
        ends_at,
        status,
        google_event_id,
        locations!inner(
          title,
          location_code,
          address_public
        )
      `,
    )
    .eq('id', reservationId)
    .maybeSingle()

  if (error) {
    logInternalError(
      '[google-calendar-sync-reservation] reservation_select_failed',
      'reservations.select_for_sync',
      error,
    )
    throw new HttpError(500, 'Could not load the reservation for Google Calendar sync.')
  }

  if (!data) {
    throw new HttpError(404, 'Reservation not found.')
  }

  return data as ReservationRow
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
  const eventInput = buildGoogleCalendarEventInput(reservation)
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

  if (!currentEventId) {
    await updateReservationSyncState(adminClient, reservation.id, {
      google_event_id: null,
      google_sync_error: null,
      google_sync_status: 'not_applicable',
    })

    return jsonResponse({
      googleEventId: null,
      googleSyncStatus: 'not_applicable',
      reservationId: reservation.id,
      status: 'not_applicable',
    }, { status: 200 })
  }

  const connection = await getActiveGoogleCalendarConnection(adminClient)
  const { accessToken } = await refreshGoogleCalendarAccessToken(connection.refreshToken)
  const deletedCurrentEvent = await deleteGoogleCalendarEvent(accessToken, currentEventId)

  if (!deletedCurrentEvent) {
    const matchedEvent = await findSingleGoogleCalendarEvent(accessToken, reservation.id)

    if (matchedEvent) {
      await deleteGoogleCalendarEvent(accessToken, matchedEvent.id)
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
