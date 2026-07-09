import { useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import type {
  AdminLocationRequest,
  LocationRequestStatus,
} from './admin-location-requests.types'
import { LOCATION_REQUEST_STATUS_OPTIONS } from './admin-location-requests.types'

type LocationRequestsAdminTableProps = {
  requests: AdminLocationRequest[]
  activeActionKey: string | null
  onUpdateStatus: (requestId: string, status: LocationRequestStatus) => Promise<void>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatLocationIdentifier(request: Pick<AdminLocationRequest, 'locationCode' | 'locationTitle'>) {
  return request.locationCode?.trim() || request.locationTitle
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
    case 'in_review':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'contacted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'closed':
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

function formatMessage(message: string | null) {
  return message && message.trim().length > 0 ? message : 'Sin mensaje'
}

function LocationRequestsAdminTable({
  requests,
  activeActionKey,
  onUpdateStatus,
}: LocationRequestsAdminTableProps) {
  const [draftStatuses, setDraftStatuses] = useState<Record<string, LocationRequestStatus>>({})

  useEffect(() => {
    setDraftStatuses(
      requests.reduce<Record<string, LocationRequestStatus>>((accumulator, request) => {
        accumulator[request.id] = request.status
        return accumulator
      }, {}),
    )
  }, [requests])

  const pendingChanges = useMemo(
    () =>
      requests.reduce<Record<string, boolean>>((accumulator, request) => {
        accumulator[request.id] =
          (draftStatuses[request.id] ?? request.status) !== request.status
        return accumulator
      }, {}),
    [draftStatuses, requests],
  )

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-950">Listado de solicitudes</h2>
        <p className="mt-1 text-sm text-slate-600">
          {requests.length} solicitudes encontradas
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Locación</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Solicitante</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mensaje</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/95 backdrop-blur-sm">
            {requests.map((request) => {
              const draftStatus = draftStatuses[request.id] ?? request.status
              const isSaving = activeActionKey === `status:${request.id}`
              const hasPendingChanges = pendingChanges[request.id] === true

              return (
                <tr key={request.id} className="align-top">
                  <td className="px-6 py-4 text-sm text-slate-900">
                    <div className="flex min-w-[220px] items-start gap-3">
                      {request.locationCoverImageUrl ? (
                        <img
                          src={request.locationCoverImageUrl}
                          alt={`Portada de ${request.locationTitle}`}
                          className="h-14 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                          Sin foto
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="font-medium text-slate-950">
                          {formatLocationIdentifier(request)}
                        </p>
                        <p className="text-sm text-slate-600">{request.locationTitle}</p>
                        <p className="text-xs text-slate-500">
                          {request.locationCategoryName?.trim() || 'Sin categoría'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    <div className="min-w-[180px] space-y-1">
                      <p className="font-medium text-slate-950">
                        {formatRequesterName(request)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {request.requesterCompanyName?.trim() || 'Sin empresa'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="min-w-[180px] space-y-1">
                      <p>{request.requesterEmail?.trim() || '-'}</p>
                      <p>{request.requesterPhone?.trim() || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="max-w-md whitespace-pre-wrap leading-6">
                      {formatMessage(request.message)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="min-w-[170px] space-y-3">
                      <span
                        className={[
                          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                          getStatusBadgeClassName(request.status),
                        ].join(' ')}
                      >
                        {getStatusLabel(request.status)}
                      </span>

                      <select
                        value={draftStatus}
                        onChange={(event) =>
                          setDraftStatuses((currentStatuses) => ({
                            ...currentStatuses,
                            [request.id]: event.target.value as LocationRequestStatus,
                          }))
                        }
                        disabled={isSaving}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {LOCATION_REQUEST_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="min-w-[150px] space-y-1">
                      <p>{formatDateTime(request.createdAt)}</p>
                      <p className="text-xs text-slate-500">
                        {request.updatedAt ? `Actualizada: ${formatDateTime(request.updatedAt)}` : '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!hasPendingChanges || activeActionKey !== null}
                      onClick={() => void onUpdateStatus(request.id, draftStatus)}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default LocationRequestsAdminTable
