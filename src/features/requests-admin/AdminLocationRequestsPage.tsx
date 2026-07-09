import { Navigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import useAuth from '../auth/useAuth'
import LocationRequestsAdminTable from './LocationRequestsAdminTable'
import {
  LOCATION_REQUEST_STATUS_OPTIONS,
  type LocationRequestStatus,
} from './admin-location-requests.types'
import { useAdminLocationRequests } from './useAdminLocationRequests'

function AdminLocationRequestsPage() {
  const { isProfileLoading, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const {
    requests,
    isLoading,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    activeActionKey,
    retry,
    updateStatus,
  } = useAdminLocationRequests(isAdmin)
  const [selectedStatus, setSelectedStatus] = useState<'all' | LocationRequestStatus>('all')

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Panel admin', to: routePaths.dashboard },
        { label: 'Solicitudes' },
      ],
      title: 'Solicitudes',
      description:
        'Gestioná las solicitudes recibidas por locación y actualizá su estado de seguimiento.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  if (isProfileLoading) {
    return (
      <PageContainer
        title="Solicitudes"
        description="Gestioná las solicitudes recibidas por locación y actualizá su estado de seguimiento."
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

  const filteredRequests =
    selectedStatus === 'all'
      ? requests
      : requests.filter((request) => request.status === selectedStatus)

  return (
    <PageContainer
      title="Solicitudes"
      description="Gestioná las solicitudes recibidas por locación y actualizá su estado de seguimiento."
      hideHeader
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            {filteredRequests.length} de {requests.length} solicitudes visibles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-100" htmlFor="request-status-filter">
            Estado
          </label>
          <select
            id="request-status-filter"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as 'all' | LocationRequestStatus)
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="all">Todos</option>
            {LOCATION_REQUEST_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      {!isLoading && !errorMessage && actionErrorMessage ? (
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos actualizar la solicitud
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionErrorMessage}
            </p>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && actionSuccessMessage ? (
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Solicitud actualizada
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionSuccessMessage}
            </p>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && filteredRequests.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title={
              requests.length === 0
                ? 'Todavía no hay solicitudes'
                : 'No hay solicitudes para este estado'
            }
            description={
              requests.length === 0
                ? 'Cuando los usuarios envíen solicitudes desde una locación, aparecerán acá.'
                : 'Probá con otro estado para ver más resultados.'
            }
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && filteredRequests.length > 0 ? (
        <LocationRequestsAdminTable
          requests={filteredRequests}
          activeActionKey={activeActionKey}
          onUpdateStatus={updateStatus}
        />
      ) : null}
    </PageContainer>
  )
}

export default AdminLocationRequestsPage
