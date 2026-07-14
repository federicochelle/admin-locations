import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { getLocationDetailPath, routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
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

function fieldValueClassName() {
  return 'text-sm leading-6 text-slate-700'
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

function ReadOnlyField({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  const normalizedValue =
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : null

  return (
    <div>
      <p className={fieldLabelClassName()}>{label}</p>
      {normalizedValue !== null ? (
        <input
          readOnly
          value={normalizedValue}
          className={[inputClassName(), 'font-medium'].join(' ')}
        />
      ) : (
        <div className={fieldValueClassName()}>{children}</div>
      )}
    </div>
  )
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
  return (
    <div className="w-full min-w-0">
      <label htmlFor="request-status" className={fieldLabelClassName()}>
        Estado
      </label>
      <select
        id="request-status"
        value={request.status}
        onChange={(event) =>
          void onSave(event.target.value as LocationRequestStatus)
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
            <div className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-6 lg:col-span-2">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">
                        Datos de la solicitud
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                        {formatDateTime(request.createdAt)}
                      </p>
                    </div>

                    <div className="w-full sm:max-w-xs">
                      <RequestManagementCard
                        key={`${request.id}:${request.updatedAt ?? request.status}`}
                        request={request}
                        isSaving={isSaving}
                        onSave={save}
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <ReadOnlyField label="Título">{request.title}</ReadOnlyField>
                    <ReadOnlyField label="Nombre">
                      {formatOptionalField(request.requesterFullName)}
                    </ReadOnlyField>
                    <ReadOnlyField label="Teléfono">
                      {formatOptionalField(request.requesterPhone)}
                    </ReadOnlyField>
                    <ReadOnlyField label="Email">
                      {formatOptionalField(request.requesterEmail)}
                    </ReadOnlyField>
                  </div>
                </div>
              </div>

              <div>
                <ReadOnlyField label="Mensaje">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {request.message?.trim() || 'Sin mensaje'}
                    </p>
                  </div>
                </ReadOnlyField>
              </div>
            </div>
          </Card>

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
                    <a
                      key={`${request.id}:${location.id}`}
                      href={getLocationDetailPath(location.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
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

                      <div className="p-5">
                        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#B8924A]">
                              {formatLocationIdentifier(location)}
                            </p>
                            <h4 className="mt-1 text-lg font-semibold text-slate-950">
                              {location.title}
                            </h4>
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
                    </a>
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
