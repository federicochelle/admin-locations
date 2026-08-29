import { Navigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import useAuth from '../auth/useAuth'
import LocationRequestsAdminTable from './LocationRequestsAdminTable'
import { useAdminLocationRequests } from './useAdminLocationRequests'

function AdminLocationRequestsPage() {
  const { isProfileLoading, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const {
    requests,
    currentPage,
    pageSize,
    totalCount,
    selectedStatus,
    isLoading,
    errorMessage,
    retry,
    setCurrentPage,
    setSelectedStatus,
  } = useAdminLocationRequests(isAdmin)

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Solicitudes' },
      ],
      title: 'Solicitudes',
      description:
        'Gestioná las solicitudes de proyectos y actualizá su estado de seguimiento.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  if (isProfileLoading) {
    return (
      <PageContainer
        title="Solicitudes"
        description="Gestioná las solicitudes de proyectos y actualizá su estado de seguimiento."
        hideHeader
      >
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Verificando permisos...</p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  if (!isAdmin) {
    return <Navigate to={routePaths.dashboard} replace />
  }

  return (
    <PageContainer
      title="Solicitudes"
      description="Gestioná las solicitudes de proyectos y actualizá su estado de seguimiento."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando solicitudes...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las solicitudes
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage ? (
        <LocationRequestsAdminTable
          requests={requests}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </PageContainer>
  )
}

export default AdminLocationRequestsPage
