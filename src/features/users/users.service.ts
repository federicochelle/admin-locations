import { getSupabaseClient } from '../../lib/supabase'
import type {
  UserDetail,
  UserListItem,
} from './users.types'
import { getAdminLocationRequests } from '../requests-admin/admin-location-requests.service'

type ProfileRow = {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  role: string | null
  avatar_url: string | null
  status: string | null
  phone: string | null
  created_at: string | null
}

function mapUserRow(row: ProfileRow): UserListItem {
  return {
    id: row.user_id,
    profileId: row.id,
    fullName: row.full_name?.trim() || null,
    email: row.email?.trim() || null,
    companyName: row.company_name?.trim() || null,
    role: row.role?.trim() || null,
    avatarUrl: row.avatar_url?.trim() || null,
    status: row.status?.trim() || null,
    phone: row.phone?.trim() || null,
    createdAt: row.created_at,
  }
}

function getExactCountOrZero(count: number | null) {
  return typeof count === 'number' && Number.isFinite(count) ? count : 0
}

export async function getUsers(): Promise<UserListItem[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, user_id, full_name, email, company_name, role, avatar_url, status, phone, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ProfileRow[]).map(mapUserRow)
}

export async function getUserByProfileId(profileId: string): Promise<UserDetail> {
  const supabase = getSupabaseClient()
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, user_id, full_name, email, company_name, role, avatar_url, status, phone, created_at',
    )
    .eq('id', profileId)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profile = (profileData ?? null) as ProfileRow | null

  if (!profile) {
    throw new Error('USER_NOT_FOUND')
  }

  const [
    requestProjectsResult,
    locationRequestsResult,
    favoritesResult,
    adminRequests,
  ] =
    await Promise.all([
      supabase
        .from('request_projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.user_id),
      supabase
        .from('location_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.user_id),
      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.user_id),
      getAdminLocationRequests(),
    ])

  if (requestProjectsResult.error) {
    throw new Error(requestProjectsResult.error.message)
  }

  if (locationRequestsResult.error) {
    throw new Error(locationRequestsResult.error.message)
  }

  if (favoritesResult.error) {
    throw new Error(favoritesResult.error.message)
  }

  return {
    ...mapUserRow(profile),
    activity: {
      requestProjectsCount: getExactCountOrZero(requestProjectsResult.count),
      locationRequestsCount: getExactCountOrZero(locationRequestsResult.count),
      favoritesCount: getExactCountOrZero(favoritesResult.count),
      requests: adminRequests.filter((request) => request.userId === profile.user_id),
    },
  }
}
