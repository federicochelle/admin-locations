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

function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const currentUser = session?.user ?? null
  const activeProfileRequestIdRef = useRef(0)
  const expectedProfileUserIdRef = useRef<string | null>(null)

  const loadProfileForUser = useCallback(async (userId: string | null) => {
    const requestId = activeProfileRequestIdRef.current + 1
    activeProfileRequestIdRef.current = requestId
    expectedProfileUserIdRef.current = userId
    setProfile(null)

    if (!userId) {
      setIsProfileLoading(false)
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
        return
      }

      setProfile(nextProfile)
    } catch (error) {
      if (
        activeProfileRequestIdRef.current !== requestId ||
        expectedProfileUserIdRef.current !== userId
      ) {
        return
      }

      console.warn('No pudimos cargar el profile del usuario autenticado.', error)
      setProfile(null)
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

    void getCurrentSession()
      .then(async (nextSession) => {
        if (!isActive) {
          return
        }

        expectedProfileUserIdRef.current = nextSession?.user.id ?? null
        setProfile(null)
        setSession(nextSession)
        await loadProfileForUser(nextSession?.user.id ?? null)
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setSession(null)
        setProfile(null)
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
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      if (!isActive) {
        return
      }

      expectedProfileUserIdRef.current = nextSession?.user.id ?? null
      setProfile(null)
      setSession(nextSession)
      setIsLoading(false)
      void loadProfileForUser(nextSession?.user.id ?? null)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
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
