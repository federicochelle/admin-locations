import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import { useAdminRequestDetail } from './useAdminRequestDetail'
import {
  LOCATION_REQUEST_STATUS_OPTIONS,
  type AdminLocationRequestDetail,
  type AdminRequestLocation,
  type LocationRequestStatus,
} from './admin-location-requests.types'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldLabelClassName() {
  return 'mb-2 block text-sm font-medium text-slate-700'
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

function getStatusLabel(status: LocationRequestStatus) {
  return (
    LOCATION_REQUEST_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  )
}

function getStatusBadgeClassName(status: LocationRequestStatus) {
  switch (status) {
    case 'submitted':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'closed':
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatLocationIdentifier(location: AdminRequestLocation) {
  const locationCode = location.locationCode?.trim()

  return locationCode ? locationCode.replaceAll('-', ' ') : location.title
}

function formatLocationMeta(location: AdminRequestLocation) {
  const values = [location.departmentName, location.zoneName]
    .map((value) => value?.trim() || null)
    .filter((value): value is string => Boolean(value))

  return values.length > 0 ? values.join(' · ') : 'Sin zona definida'
}

function RequestManagementCard({
  isSaving,
  request,
  onSave,
}: {
  isSaving: boolean
  request: AdminLocationRequestDetail
  onSave: (status: LocationRequestStatus) => Promise<void>
}) {
  const [draftStatus, setDraftStatus] = useState<LocationRequestStatus>(request.status)
  const hasPendingChanges = draftStatus !== request.status

  return (
    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <label htmlFor="request-status" className={fieldLabelClassName()}>
          Estado
        </label>
        <select
          id="request-status"
          value={draftStatus}
          onChange={(event) =>
            setDraftStatus(event.target.value as LocationRequestStatus)
          }
          disabled={isSaving}
          className={inputClassName()}
        >
          {LOCATION_REQUEST_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => void onSave(draftStatus)}
          disabled={!hasPendingChanges || isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}

function AdminRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    request,
    isLoading,
    isSaving,
    errorMessage,
    saveErrorMessage,
    saveSuccessMessage,
    reload,
    save,
  } = useAdminRequestDetail(id)

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Panel admin', to: routePaths.dashboard },
        { label: 'Solicitudes', to: routePaths.requests },
        { label: request?.title ?? 'Detalle' },
      ],
      title: request?.title ?? 'Detalle de solicitud',
      description:
        'Revisá la información del proyecto solicitado, sus locaciones incluidas y actualizá el estado interno.',
    }),
    [request],
  )

  useLayoutHeader(headerConfig)

  const isNotFound = errorMessage === 'REQUEST_NOT_FOUND'

  return (
    <PageContainer
      title="Detalle de solicitud"
      description="Revisá la información del proyecto solicitado, sus locaciones incluidas y actualizá el estado interno."
      hideHeader
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={routePaths.requests}
          className={[buttonBaseClassName, buttonVariantClasses.secondary].join(' ')}
        >
          Volver a solicitudes
        </Link>
        {!isLoading && !errorMessage ? (
          <button
            type="button"
            onClick={() => void reload()}
            className="text-sm font-medium text-slate-300 hover:text-white"
          >
            Actualizar vista
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando solicitud...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {isNotFound
                  ? 'No encontramos la solicitud'
                  : 'No pudimos cargar la solicitud'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isNotFound
                  ? 'La solicitud que intentaste abrir no existe o ya no está disponible.'
                  : errorMessage}
              </p>
            </div>
            {!isNotFound ? (
              <Button variant="secondary" onClick={() => void reload()}>
                Reintentar
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && request ? (
        <>
          {saveErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos guardar los cambios
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {saveErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {saveSuccessMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Solicitud actualizada
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {saveSuccessMessage}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                      getStatusBadgeClassName(request.status),
                    ].join(' ')}
                  >
                    {getStatusLabel(request.status)}
                  </span>
                  <p className="text-sm text-slate-500">
                    Recibida el {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {request.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {request.locations.length} locaciones incluidas
                  </p>
                </div>
              </div>

              <RequestManagementCard
                key={`${request.id}:${request.updatedAt ?? request.status}`}
                request={request}
                isSaving={isSaving}
                onSave={save}
              />
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Datos de la solicitud
                  </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="request-title" className={fieldLabelClassName()}>
                      Título
                    </label>
                    <input
                      id="request-title"
                      readOnly
                      value={request.title}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <label htmlFor="request-created-at" className={fieldLabelClassName()}>
                      Fecha
                    </label>
                    <input
                      id="request-created-at"
                      readOnly
                      value={formatDateTime(request.createdAt)}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <label htmlFor="request-status-value" className={fieldLabelClassName()}>
                      Estado
                    </label>
                    <input
                      id="request-status-value"
                      readOnly
                      value={getStatusLabel(request.status)}
                      className={inputClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="request-message" className={fieldLabelClassName()}>
                      Mensaje / brief
                    </label>
                    <textarea
                      id="request-message"
                      readOnly
                      rows={7}
                      value={request.message?.trim() || 'Sin mensaje'}
                      className={inputClassName()}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Datos del solicitante
                  </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="requester-name" className={fieldLabelClassName()}>
                      Nombre
                    </label>
                    <input
                      id="requester-name"
                      readOnly
                      value={formatOptionalField(request.requesterFullName)}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <label htmlFor="requester-company" className={fieldLabelClassName()}>
                      Empresa
                    </label>
                    <input
                      id="requester-company"
                      readOnly
                      value={formatOptionalField(request.requesterCompanyName)}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <label htmlFor="requester-email" className={fieldLabelClassName()}>
                      Email
                    </label>
                    <input
                      id="requester-email"
                      readOnly
                      value={formatOptionalField(request.requesterEmail)}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <label htmlFor="requester-phone" className={fieldLabelClassName()}>
                      Teléfono
                    </label>
                    <input
                      id="requester-phone"
                      readOnly
                      value={formatOptionalField(request.requesterPhone)}
                      className={inputClassName()}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Locaciones incluidas
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {request.locations.length} locaciones asociadas a esta solicitud.
                  </p>
                </div>
              </div>

              {request.locations.length === 0 ? (
                <EmptyState
                  title="No hay locaciones asociadas"
                  description="Esta solicitud no tiene locaciones vinculadas para mostrar en la ficha."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {request.locations.map((location) => (
                    <div
                      key={`${request.id}:${location.id}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      {location.coverImageUrl ? (
                        <img
                          src={location.coverImageUrl}
                          alt={`Imagen de ${location.title}`}
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-slate-200 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                          Sin imagen
                        </div>
                      )}

                      <div className="space-y-3 p-5">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#B8924A]">
                            {formatLocationIdentifier(location)}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-slate-950">
                            {location.title}
                          </h4>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Categoría
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {formatOptionalField(location.categoryName)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Ubicación
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {formatLocationMeta(location)}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}

export default AdminRequestDetailPage
