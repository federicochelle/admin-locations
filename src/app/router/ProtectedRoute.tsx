import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../features/auth/useAuth'
import { routePaths } from './route-paths'

function ProtectedRoute() {
  const { currentUser, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <p className="text-sm text-slate-600">Verificando sesión...</p>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to={routePaths.login} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
