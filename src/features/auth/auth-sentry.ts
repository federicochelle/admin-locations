import type { User } from '@supabase/supabase-js'
import * as Sentry from '@sentry/react'
import type { Profile } from './auth-context'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sentryAuthUser(user: Pick<User, 'id' | 'email'> | null) {
  if (!user || !uuid.test(user.id)) return null
  const email = typeof user.email === 'string' && user.email.includes('@') ? user.email : undefined
  return { id: user.id, ...(email ? { email } : {}) }
}

export function clearSentryAdminIdentity() {
  Sentry.setUser(null)
  Sentry.setContext('admin_profile', null)
  const scope = Sentry.getCurrentScope()
  scope.setTag('profile_id', undefined)
  scope.setTag('role', undefined)
}

export function applySentryAuthSession(user: Pick<User, 'id' | 'email'> | null) {
  const sentryUser = sentryAuthUser(user)
  if (!sentryUser) {
    clearSentryAdminIdentity()
    return
  }
  Sentry.setUser(sentryUser)
}

export function applySentryAdminProfile(profile: Pick<Profile, 'id' | 'role' | 'user_id'> | null, expectedUserId: string | null) {
  if (!profile || profile.user_id !== expectedUserId || !uuid.test(profile.id)) {
    Sentry.setContext('admin_profile', null)
    const scope = Sentry.getCurrentScope()
    scope.setTag('profile_id', undefined)
    scope.setTag('role', undefined)
    return
  }

  const role = profile.role === 'admin' ? profile.role : undefined
  const scope = Sentry.getCurrentScope()
  scope.setTag('profile_id', profile.id)
  scope.setTag('role', role)
  Sentry.setContext('admin_profile', {
    profile_id: profile.id,
    ...(role ? { role } : {}),
  })
}
