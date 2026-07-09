import { getSupabaseClient } from '../../lib/supabase'
import type {
  AdminLocationRequest,
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

type LocationRequestLocationRelation =
  | {
      id: string
      title: string
      location_code: string | null
      location_images: LocationImageRelation
      categories: NameRelation
    }
  | {
      id: string
      title: string
      location_code: string | null
      location_images: LocationImageRelation
      categories: NameRelation
    }[]
  | null

type LocationRequestRow = {
  id: string
  user_id: string
  location_id: string
  message: string | null
  status: LocationRequestStatus
  created_at: string
  updated_at: string | null
  locations: LocationRequestLocationRelation
}

type ProfileRow = {
  user_id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  phone: string | null
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
  relation: LocationRequestLocationRelation,
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

export async function getAdminLocationRequests(): Promise<AdminLocationRequest[]> {
  const supabase = getSupabaseClient()

  const { data: requestsData, error: requestsError } = await supabase
    .from('location_requests')
    .select(
      `
        id,
        user_id,
        location_id,
        message,
        status,
        created_at,
        updated_at,
        locations(
          id,
          title,
          location_code,
          location_images(url, is_cover),
          categories(name)
        )
      `,
    )
    .order('created_at', { ascending: false })

  if (requestsError) {
    throw new Error(requestsError.message)
  }

  const requestRows = (requestsData ?? []) as LocationRequestRow[]
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
    const location = getLocationRelation(row.locations)
    const profile = profilesByUserId.get(row.user_id) ?? null

    return {
      id: row.id,
      userId: row.user_id,
      locationId: row.location_id,
      message: row.message?.trim() || null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requesterFullName: profile?.full_name?.trim() || null,
      requesterEmail: profile?.email?.trim() || null,
      requesterCompanyName: profile?.company_name?.trim() || null,
      requesterPhone: profile?.phone?.trim() || null,
      locationTitle: location?.title?.trim() || 'Locación sin título',
      locationCode: location?.location_code?.trim() || null,
      locationCoverImageUrl: getCoverImageUrl(location?.location_images ?? null),
      locationCategoryName: getRelationName(location?.categories ?? null),
    }
  })
}

export async function updateAdminLocationRequestStatus(
  requestId: string,
  status: LocationRequestStatus,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('location_requests')
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
