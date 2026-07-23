import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import { getRequiredEnv } from './env.ts'
import { HttpError, logInternalError } from './http.ts'

type AdminProfile = {
  id: string
  user_id: string
  role: string | null
  status: string | null
}

export type AdminContext = {
  adminClient: SupabaseClient
  profile: AdminProfile
  user: User
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header.')
  }

  return authorization.slice('Bearer '.length).trim()
}

function createAdminClient() {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

export async function assertActiveAdminProfile(
  adminClient: SupabaseClient,
  userId: string,
) {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, user_id, role, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    logInternalError(
      '[google-calendar-auth] admin_profile_select_failed',
      'profiles.select_active_admin',
      profileError,
    )
    throw new HttpError(500, 'Could not validate admin profile.', profileError.message)
  }

  const typedProfile = profile as AdminProfile | null

  if (
    !typedProfile ||
    typedProfile.role !== 'admin' ||
    typedProfile.status !== 'active'
  ) {
    throw new HttpError(403, 'You are not allowed to access this resource.')
  }

  return typedProfile
}

export function getServiceRoleClient() {
  return createAdminClient()
}

export async function assertAdmin(request: Request): Promise<AdminContext> {
  const token = getBearerToken(request)
  const adminClient = createAdminClient()

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token)

  if (userError || !user) {
    throw new HttpError(401, 'Invalid or expired user session.', userError?.message)
  }

  const typedProfile = await assertActiveAdminProfile(adminClient, user.id)

  return {
    adminClient,
    profile: typedProfile,
    user,
  }
}
