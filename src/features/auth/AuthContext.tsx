import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import {
  getCurrentSession,
  signOut as signOutFromService,
} from './auth.service'
import {
  AuthContext,
  type AuthContextValue,
  type Profile,
} from './auth-context'
import {
  applySentryAdminProfile,
  applySentryAuthSession,
  clearSentryAdminIdentity,
} from './auth-sentry'

function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const currentUser = session?.user ?? null
  const activeProfileRequestIdRef = useRef(0)
  const expectedProfileUserIdRef = useRef<string | null>(null)
  const latestProfileRef = useRef<Profile | null>(null)
  const latestSessionUserIdRef = useRef<string | null>(null)

  const loadProfileForUser = useCallback(async (
    userId: string | null,
    options?: {
      preserveExistingProfile?: boolean
    },
  ) => {
    const requestId = activeProfileRequestIdRef.current + 1
    activeProfileRequestIdRef.current = requestId
    expectedProfileUserIdRef.current = userId

    if (!options?.preserveExistingProfile) {
      setProfile(null)
      latestProfileRef.current = null
    }

    if (!userId) {
      setIsProfileLoading(false)
      applySentryAdminProfile(null, null)
      return
    }

    const supabase = getSupabaseClient()
    setIsProfileLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, user_id, full_name, company_name, email, phone, role, avatar_url, status, created_at',
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (
        activeProfileRequestIdRef.current !== requestId ||
        expectedProfileUserIdRef.current !== userId
      ) {
        return
      }

      const nextProfile = (data ?? null) as Profile | null

      if (!nextProfile || nextProfile.user_id !== userId) {
        setProfile(null)
        latestProfileRef.current = null
        applySentryAdminProfile(null, userId)
        return
      }

      setProfile(nextProfile)
      latestProfileRef.current = nextProfile
      applySentryAdminProfile(nextProfile, userId)
    } catch (error) {
      if (
        activeProfileRequestIdRef.current !== requestId ||
        expectedProfileUserIdRef.current !== userId
      ) {
        return
      }

      console.warn('No pudimos cargar el profile del usuario autenticado.', error)

      if (!options?.preserveExistingProfile) {
        setProfile(null)
        latestProfileRef.current = null
        applySentryAdminProfile(null, userId)
      }
    } finally {
      if (
        activeProfileRequestIdRef.current === requestId &&
        expectedProfileUserIdRef.current === userId
      ) {
        setIsProfileLoading(false)
      }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfileForUser(currentUser?.id ?? null)
  }, [currentUser?.id, loadProfileForUser])

  useEffect(() => {
    let isActive = true
    let hasAuthStateChange = false
    clearSentryAdminIdentity()

    void getCurrentSession()
      .then(async (nextSession) => {
        if (!isActive || hasAuthStateChange) {
          return
        }

        applySentryAuthSession(nextSession?.user ?? null)
        expectedProfileUserIdRef.current = nextSession?.user.id ?? null
        latestSessionUserIdRef.current = nextSession?.user.id ?? null
        setProfile(null)
        latestProfileRef.current = null
        setSession(nextSession)
        await loadProfileForUser(nextSession?.user.id ?? null)
      })
      .catch(() => {
        if (!isActive || hasAuthStateChange) {
          return
        }

        clearSentryAdminIdentity()
        setSession(null)
        setProfile(null)
        latestSessionUserIdRef.current = null
        latestProfileRef.current = null
        setIsProfileLoading(false)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    const supabase = getSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isActive) {
        return
      }

      hasAuthStateChange = true
      applySentryAuthSession(nextSession?.user ?? null)
      const previousUserId = latestSessionUserIdRef.current
      const nextUserId = nextSession?.user.id ?? null
      const isSameUser = previousUserId !== null && previousUserId === nextUserId
      const preserveExistingProfile =
        isSameUser &&
        Boolean(
          latestProfileRef.current &&
            latestProfileRef.current.user_id === nextUserId,
        )

      if (import.meta.env.DEV) {
        console.debug('[Auth]', {
          event,
          previousUserId,
          nextUserId,
          hasExistingProfile: preserveExistingProfile,
        })
      }

      expectedProfileUserIdRef.current = nextUserId
      latestSessionUserIdRef.current = nextUserId
      setSession(nextSession)
      setIsLoading(false)

      if (!nextUserId) {
        setProfile(null)
        latestProfileRef.current = null
        setIsProfileLoading(false)
        applySentryAdminProfile(null, null)
        return
      }

      if (!preserveExistingProfile) {
        setProfile(null)
        latestProfileRef.current = null
        applySentryAdminProfile(null, nextUserId)
      }

      void loadProfileForUser(nextUserId, {
        preserveExistingProfile,
      })
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
      clearSentryAdminIdentity()
    }
  }, [loadProfileForUser])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isLoading,
      isProfileLoading,
      profile,
      refreshProfile,
      session,
      signOut: signOutFromService,
    }),
    [currentUser, isLoading, isProfileLoading, profile, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
