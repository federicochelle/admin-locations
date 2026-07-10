import { getSupabaseClient } from '../../lib/supabase'
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
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('reservations')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return (data as ReservationIdRow).id
}

export async function updateReservation(
  id: string,
  payload: ReservationUpdatePayload,
): Promise<string> {
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

  return (data as ReservationIdRow).id
}

export async function deleteReservation(id: string): Promise<string> {
  const supabase = getSupabaseClient()

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
