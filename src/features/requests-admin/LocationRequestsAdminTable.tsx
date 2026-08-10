import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { getRequestDetailPath } from '../../app/router/route-paths'
import type {
  AdminLocationRequest,
  LocationRequestStatus,
} from './admin-location-requests.types'
import { LOCATION_REQUEST_STATUS_OPTIONS } from './admin-location-requests.types'

type LocationRequestsAdminTableProps = {
  requests: AdminLocationRequest[]
  totalCount: number
  selectedStatus: 'all' | LocationRequestStatus
  onSelectedStatusChange: (status: 'all' | LocationRequestStatus) => void
  onCreateRequest?: () => void
  isCreatingRequest?: boolean
  isEmbedded?: boolean
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getStatusLabel(status: LocationRequestStatus) {
  return (
    LOCATION_REQUEST_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  )
}

function getStatusBadgeClassName(status: LocationRequestStatus) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'discarded':
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

function formatRequesterName(request: AdminLocationRequest) {
  const fullName = request.requesterFullName?.trim()

  if (fullName) {
    return fullName
  }

  return request.requesterEmail?.trim() || 'Usuario sin nombre'
}

function LocationRequestsAdminTable({
  requests,
  totalCount,
  selectedStatus,
  onSelectedStatusChange,
  onCreateRequest,
  isCreatingRequest = false,
  isEmbedded = false,
}: LocationRequestsAdminTableProps) {
  const navigate = useNavigate()
  const hasRequests = requests.length > 0

  function isInteractiveEventTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="button"]',
      ),
    )
  }

  function handleRowNavigation(
    requestId: string,
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (isInteractiveEventTarget(event.target)) {
      return
    }

    navigate(getRequestDetailPath(requestId))
  }

  const content = (
    <>
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de solicitudes</h2>
            <p className="mt-1 text-sm text-slate-600">
              {totalCount} {totalCount === 1 ? 'solicitud recibida' : 'solicitudes recibidas'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="request-status-filter">
                Estado
              </label>
              <select
                id="request-status-filter"
                value={selectedStatus}
                onChange={(event) =>
                  onSelectedStatusChange(event.target.value as 'all' | LocationRequestStatus)
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

            {onCreateRequest ? (
              <Button onClick={onCreateRequest} disabled={isCreatingRequest}>
                {isCreatingRequest ? 'Creando...' : 'Nueva solicitud'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Fecha</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Campaña</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Solicitante</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Locaciones</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {hasRequests
              ? requests.map((request) => {
                  return (
                    <tr
                      key={request.id}
                      tabIndex={0}
                      className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)] focus-visible:bg-[rgba(184,146,74,0.10)] focus-visible:outline-none"
                      onClick={(event) => handleRowNavigation(request.id, event)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return
                        }

                        event.preventDefault()
                        handleRowNavigation(request.id, event)
                      }}
                    >
                      <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                        <div className="min-w-[150px]">
                          <p className="font-medium text-slate-900">
                            {formatDate(request.submittedAt)}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {formatTime(request.submittedAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="min-w-[240px]">
                          <p className="font-medium text-slate-950">{request.title}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="min-w-[180px]">
                          <p className="font-medium text-slate-950">{formatRequesterName(request)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                        <div className="min-w-[140px]">
                          <p className="font-medium text-slate-900">{request.locationCount}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                        <div className="min-w-[150px]">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                              getStatusBadgeClassName(request.status),
                            ].join(' ')}
                          >
                            {getStatusLabel(request.status)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-sm text-slate-600 sm:px-6">
                    <div className="flex min-h-24 items-center justify-center text-center">
                      <p>
                        {totalCount === 0
                          ? 'Todavía no hay solicitudes. Cuando los usuarios envíen solicitudes de proyectos, aparecerán acá.'
                          : 'No hay solicitudes para este estado. Probá con otro filtro para ver más resultados.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </>
  )

  if (isEmbedded) {
    return <div className="overflow-hidden rounded-2xl">{content}</div>
  }

  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      {content}
    </Card>
  )
}

export default LocationRequestsAdminTable
