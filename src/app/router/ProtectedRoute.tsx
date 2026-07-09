import { useEffect, useState } from 'react'
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
  const [isSigningOutUnauthorizedUser, setIsSigningOutUnauthorizedUser] =
    useState(false)
  const hasAuthorizedAdminAccess = hasActiveAdminAccess(currentUser, profile)

  const isUnauthorizedAdminAccess =
    Boolean(currentUser) &&
    !isProfileLoading &&
    !hasAuthorizedAdminAccess

  useEffect(() => {
    if (!isUnauthorizedAdminAccess || isSigningOutUnauthorizedUser) {
      return
    }

    let isActive = true

    setIsSigningOutUnauthorizedUser(true)

    void signOut()
      .catch((error) => {
        console.warn('No pudimos cerrar la sesión de un usuario sin acceso admin.', error)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsSigningOutUnauthorizedUser(false)
      })

    return () => {
      isActive = false
    }
  }, [isSigningOutUnauthorizedUser, isUnauthorizedAdminAccess, signOut])

  if (isLoading || (currentUser && isProfileLoading) || isSigningOutUnauthorizedUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <p className="text-sm text-slate-600">
          {isSigningOutUnauthorizedUser
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
