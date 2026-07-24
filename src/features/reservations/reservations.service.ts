import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'
import type {
  ReservationCreatePayload,
  ReservationListItem,
  ReservationStatus,
  ReservationUpdatePayload,
} from './reservations.types'

type LocationRelation =
  | {
      title: string | null
      location_code: string | null
    }
  | {
      title: string | null
      location_code: string | null
    }[]
  | null

type ReservationRow = {
  id: string
  location_id: string
  title: string
  starts_at: string
  ends_at: string
  status: ReservationStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  locations: LocationRelation
}

type ReservationIdRow = {
  id: string
}

type GoogleCalendarSyncInput = {
  reservationId: string
}

type ReservationSaveResult = {
  id: string
  syncWarning: string | null
}

const GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE =
  'Reserva guardada, pero no se pudo sincronizar con Google Calendar.'

function getLocationRelation(relation: LocationRelation) {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation
}

function mapReservation(row: ReservationRow): ReservationListItem {
  const location = getLocationRelation(row.locations)

  return {
    id: row.id,
    locationId: row.location_id,
    locationTitle: location?.title?.trim() || 'Locación sin título',
    locationCode: location?.location_code?.trim() || null,
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
): Promise<string | null> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.functions.invoke('google-calendar-sync-reservation', {
    body: {
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

  return syncErrorMessage.trim()
    ? `${GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE} ${syncErrorMessage.trim()}`
    : GOOGLE_CALENDAR_SYNC_WARNING_MESSAGE
}

export async function getReservations(): Promise<ReservationListItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
        id,
        location_id,
        title,
        starts_at,
        ends_at,
        status,
        notes,
        created_by,
        created_at,
        updated_at,
        locations(
          title,
          location_code
        )
      `,
    )
    .order('starts_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ReservationRow[]).map(mapReservation)
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
  const syncWarning = await syncReservationWithGoogleCalendar({ reservationId: id })

  return {
    id,
    syncWarning,
  }
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
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const savedId = (data as ReservationIdRow).id
  const syncWarning = await syncReservationWithGoogleCalendar({ reservationId: savedId })

  return {
    id: savedId,
    syncWarning,
  }
}

export async function deleteReservation(id: string): Promise<string> {
  const supabase = getSupabaseClient()

  // TODO: Sync Google Calendar before hard delete because the Edge Function needs to read the reservation first.
  const { data, error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as ReservationIdRow).id
}
