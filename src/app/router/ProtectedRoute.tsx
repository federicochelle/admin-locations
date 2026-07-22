import { useEffect, useRef } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../features/auth/useAuth'
import { hasActiveAdminAccess } from '../../features/auth/auth-context'
import { routePaths } from './route-paths'

function ProtectedRoute() {
  const {
    currentUser,
    isLoading,
    isProfileLoading,
    profile,
    signOut,
  } = useAuth()
  const isSigningOutUnauthorizedUserRef = useRef(false)
  const hasAuthorizedAdminAccess = hasActiveAdminAccess(currentUser, profile)
  const isUnauthorizedAdminAccess =
    Boolean(currentUser) &&
    !isProfileLoading &&
    !hasAuthorizedAdminAccess
  const shouldBlockRouteRender =
    isLoading ||
    isUnauthorizedAdminAccess ||
    (Boolean(currentUser) && !profile && isProfileLoading)

  useEffect(() => {
    if (!isUnauthorizedAdminAccess || isSigningOutUnauthorizedUserRef.current) {
      return
    }

    let isActive = true
    isSigningOutUnauthorizedUserRef.current = true

    void signOut()
      .catch((error) => {
        console.warn('No pudimos cerrar la sesión de un usuario sin acceso admin.', error)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isSigningOutUnauthorizedUserRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isUnauthorizedAdminAccess, signOut])

  if (shouldBlockRouteRender) {
    if (import.meta.env.DEV) {
      console.debug('[Auth] blocking route render', {
        isLoading,
        isProfileLoading,
        hasProfile: Boolean(profile),
      })
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <p className="text-sm text-slate-600">
          {isUnauthorizedAdminAccess
            ? 'Verificando permisos...'
            : 'Verificando sesión...'}
        </p>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to={routePaths.login} replace />
  }

  if (!hasAuthorizedAdminAccess) {
    return <Navigate to={routePaths.login} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
