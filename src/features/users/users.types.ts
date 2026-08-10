import type { AdminLocationRequest } from '../requests-admin/admin-location-requests.types'

export type UserRoleFilter = 'all' | 'admin' | 'visitor'

export type UserStatusFilter = 'all' | 'active' | 'inactive' | 'blocked'

export type UserListItem = {
  id: string
  profileId: string
  fullName: string | null
  email: string | null
  companyName: string | null
  role: string | null
  avatarUrl: string | null
  status: string | null
  phone: string | null
  createdAt: string | null
}

export type UserActivitySummary = {
  requestProjectsCount: number
  locationRequestsCount: number
  favoritesCount: number
  requests: AdminLocationRequest[]
}

export type UserDetail = UserListItem & {
  activity: UserActivitySummary
}

export function getUserRoleKey(role: string | null | undefined): Exclude<UserRoleFilter, 'all'> {
  const normalizedRole = role?.trim().toLocaleLowerCase()

  return normalizedRole === 'admin' ? 'admin' : 'visitor'
}

export function getUserRoleLabel(role: string | null | undefined) {
  return getUserRoleKey(role) === 'admin' ? 'Admin' : 'Visitante'
}

export function getUserStatusKey(
  status: string | null | undefined,
): Exclude<UserStatusFilter, 'all'> {
  const normalizedStatus = status?.trim().toLocaleLowerCase()

  if (normalizedStatus === 'active') {
    return 'active'
  }

  if (normalizedStatus === 'blocked') {
    return 'blocked'
  }

  return 'inactive'
}

export function getUserStatusLabel(status: string | null | undefined) {
  const statusKey = getUserStatusKey(status)

  if (statusKey === 'active') {
    return 'Activo'
  }

  if (statusKey === 'blocked') {
    return 'Bloqueado'
  }

  return 'Inactivo'
}
