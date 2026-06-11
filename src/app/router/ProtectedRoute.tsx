import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import { getCurrentSession } from '../../features/auth/auth.service'
import { routePaths } from './route-paths'

function ProtectedRoute() {
  const [session, setSession] = useState<Session | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let isActive = true

    void getCurrentSession()
      .then((nextSession) => {
        if (!isActive) {
          return
        }

        setSession(nextSession)
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setSession(null)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsCheckingSession(false)
      })

    const supabase = getSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      if (!isActive) {
        return
      }

      setSession(nextSession)
      setIsCheckingSession(false)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <p className="text-sm text-slate-600">Verificando sesión...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to={routePaths.login} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
