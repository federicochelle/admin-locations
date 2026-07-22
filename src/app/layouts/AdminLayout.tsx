import { Navigate, Outlet } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import Sidebar from '../../components/navigation/Sidebar'
import { routePaths } from '../router/route-paths'
import { hasActiveAdminAccess } from '../../features/auth/auth-context'
import useAuth from '../../features/auth/useAuth'
import { LayoutHeaderProvider } from './LayoutHeaderContext'

function AdminLayout() {
  const { currentUser, isLoading, isProfileLoading, profile } = useAuth()
  const hasAuthorizedAdminAccess = hasActiveAdminAccess(currentUser, profile)
  const shouldBlockLayoutRender =
    isLoading || (Boolean(currentUser) && !profile && isProfileLoading)

  if (shouldBlockLayoutRender) {
    if (import.meta.env.DEV) {
      console.debug('[Auth] blocking route render', {
        isLoading,
        isProfileLoading,
        hasProfile: Boolean(profile),
      })
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <p className="text-sm text-slate-600">Verificando permisos...</p>
      </div>
    )
  }

  if (!hasAuthorizedAdminAccess) {
    return <Navigate to={routePaths.login} replace />
  }

  return (
    <LayoutHeaderProvider>
      <div className="min-h-screen bg-black text-slate-900">
        <Sidebar />
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.10),_transparent_24%),linear-gradient(180deg,_#111111_0%,_#151515_52%,_#1a1a1a_100%)] md:ml-72">
          <Header />
          <main className="relative px-3 py-4 sm:px-8 sm:py-5">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutHeaderProvider>
  )
}

export default AdminLayout
