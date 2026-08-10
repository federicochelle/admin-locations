import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import RequestIncludedLocationsTable from './RequestIncludedLocationsTable'
import { openOfficialRequestProjectPdf } from './pdf/request-selection-pdf.service'
import { useAdminRequestDetail } from './useAdminRequestDetail'
import {
  LOCATION_REQUEST_STATUS_OPTIONS,
  type AdminLocationRequestVersion,
  type AdminLocationRequestDetail,
  type LocationRequestStatus,
} from './admin-location-requests.types'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldLabelClassName() {
  return 'mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'
}

function fieldValueClassName() {
  return 'text-sm leading-6 text-slate-700'
}

function getRequestStatusSelectClassName(status: LocationRequestStatus) {
  switch (status) {
    case 'pending':
      return '!border-amber-300 !bg-amber-100 !text-amber-800 focus:!border-amber-400 focus:!ring-amber-200'
    case 'confirmed':
      return '!border-emerald-300 !bg-emerald-100 !text-emerald-800 focus:!border-emerald-400 focus:!ring-emerald-200'
    case 'discarded':
      return '!border-slate-300 !bg-slate-100 !text-slate-800 focus:!border-slate-400 focus:!ring-slate-200'
  }
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function buildDeleteConfirmationMessage(request: AdminLocationRequestDetail, activeReservationsCount: number) {
  if (activeReservationsCount === 0) {
    return '¿Estás seguro que querés eliminar?'
  }

  const activeReservationLines = request.locations
    .filter(
      (location) =>
        location.reservationId &&
        (location.reservationRecordStatus === 'pending' ||
          location.reservationRecordStatus === 'confirmed'),
    )
    .map((location) => {
      const reservationDate = location.reservationStartsAt
        ? formatDisplayDate(location.reservationStartsAt)
        : '-'

      return `- ${location.title} · ${reservationDate}`
    })

  return [
    `Esta solicitud tiene ${activeReservationsCount} reserva${activeReservationsCount === 1 ? '' : 's'} activa${activeReservationsCount === 1 ? '' : 's'}:`,
    activeReservationLines.join('\n'),
    '',
    'Si continuás, se eliminarán del calendario.',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}

function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDate(value)
  }

  return value
}

function formatVersionNumber(value: number | null) {
  return value === null ? '-' : String(value)
}

function formatVersionCreatedAt(value: string | null) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7.5v5l3 1.8" />
    </svg>
  )
}

function VersionSelectorModal({
  activeVersionId,
  isSubmitting,
  onClose,
  onConfirm,
  versions,
}: {
  activeVersionId: string | null
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (versionId: string) => Promise<void>
  versions: AdminLocationRequestVersion[]
}) {
  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-version-selector-title"
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="request-version-selector-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              Historial de versiones
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar historial de versiones"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 max-h-[28rem] overflow-y-auto rounded-2xl border border-slate-200">
          <ul className="divide-y divide-slate-200">
            {versions.map((version) => {
              const isSelected = selectedVersionId === version.id

              return (
                <li key={version.id}>
                  <label
                    className={[
                      'flex cursor-pointer items-start gap-4 px-5 py-4 transition',
                      isSelected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="request-version"
                      value={version.id}
                      checked={isSelected}
                      onChange={(event) => setSelectedVersionId(event.target.value)}
                      disabled={isSubmitting}
                      className="mt-1 h-4 w-4 border-slate-300 text-slate-950 focus:ring-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">
                          {`Versión ${formatVersionNumber(version.versionNumber)}`}
                        </p>
                        {version.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            Actual
                          </span>
                        ) : null}
                        {version.isLatest ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                            Más reciente
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {formatVersionCreatedAt(version.createdAt)}
                      </p>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(selectedVersionId)}
            disabled={isSubmitting || !selectedVersionId || selectedVersionId === activeVersionId}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Actualizando...' : 'Ver esta versión'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestDetailField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
        {formatOptionalField(value)}
      </p>
    </div>
  )
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
  isDeleting,
  isGeneratingPdf,
  isSaving,
  isSwitchingVersion,
  onDelete,
  onOpenPdf,
  onOpenVersions,
  pendingVersionCount,
  request,
  onSave,
}: {
  isDeleting: boolean
  isGeneratingPdf: boolean
  isSaving: boolean
  isSwitchingVersion: boolean
  onDelete: () => void
  onOpenPdf: () => void
  onOpenVersions: () => void
  pendingVersionCount: number
  request: AdminLocationRequestDetail
  onSave: (status: LocationRequestStatus) => Promise<void>
}) {
  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-3">
        <select
          id="request-status"
          value={request.status}
          onChange={(event) =>
            void onSave(event.target.value as LocationRequestStatus)
          }
          disabled={isSaving}
          className={[
            inputClassName(),
            getRequestStatusSelectClassName(request.status),
            'flex-1 font-semibold',
          ].join(' ')}
        >
          {LOCATION_REQUEST_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onOpenVersions}
            disabled={isSwitchingVersion || request.versions.length === 0}
            aria-label="Abrir historial de versiones"
            title="Abrir historial de versiones"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HistoryIcon />
          </button>
          {pendingVersionCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {pendingVersionCount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenPdf}
          disabled={isGeneratingPdf || isDeleting || !request.officialPdf}
          aria-label="Ver PDF"
          title="Ver PDF"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M8.5 15h1.25a1.25 1.25 0 1 0 0-2.5H8.5V17" />
            <path d="M12 17v-4.5h1.25a1.75 1.75 0 1 1 0 3.5H12" />
            <path d="M16 17v-4.5h2" />
            <path d="M16 14.75h1.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting || isSaving || isGeneratingPdf}
          aria-label={isDeleting ? 'Eliminando solicitud...' : 'Eliminar solicitud'}
          title={isDeleting ? 'Eliminando solicitud...' : 'Eliminar solicitud'}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function AdminRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    request,
    isLoading,
    isSaving,
    isSwitchingVersion,
    isDeleting,
    errorMessage,
    saveErrorMessage,
    versionErrorMessage,
    deleteErrorMessage,
    reload,
    save,
    selectVersion,
    getDeleteImpact,
    remove,
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null)
  const companyName = request?.productionCompany ?? null
  const tentativeStartDate = request?.tentativeStartDate ?? null
  const tentativeEndDate = request?.tentativeEndDate ?? null
  const displayMessage = request?.message ?? null
  const pendingVersionCount =
    request &&
    request.latestVersionNumber !== null &&
    request.activeVersionNumber !== null &&
    request.latestVersionNumber > request.activeVersionNumber
      ? request.latestVersionNumber - request.activeVersionNumber
      : 0

  async function handleOpenPdf() {
    if (!request || isGeneratingPdf) {
      return
    }

    try {
      setIsGeneratingPdf(true)
      setPdfErrorMessage(null)
      await openOfficialRequestProjectPdf(request.officialPdf)
    } catch (error) {
      setPdfErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos abrir el PDF oficial de la solicitud.',
      )
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  async function handleDelete() {
    if (!request || isDeleting) {
      return
    }

    const activeReservationsCount = await getDeleteImpact()
    const confirmationMessage = buildDeleteConfirmationMessage(
      request,
      activeReservationsCount,
    )
    const confirmed = window.confirm(confirmationMessage)

    if (!confirmed) {
      return
    }

    const deleted = await remove()

    if (deleted) {
      navigate(routePaths.requests)
    }
  }

  async function handleSelectVersion(versionId: string) {
    if (!versionId || isSwitchingVersion) {
      return
    }

    await selectVersion(versionId)
    setIsVersionModalOpen(false)
  }

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
          {isVersionModalOpen ? (
            <VersionSelectorModal
              activeVersionId={request.activeVersionId}
              isSubmitting={isSwitchingVersion}
              versions={request.versions}
              onClose={() => {
                if (isSwitchingVersion) {
                  return
                }

                setIsVersionModalOpen(false)
              }}
              onConfirm={handleSelectVersion}
            />
          ) : null}

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

          {versionErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos cambiar la versión
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {versionErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {deleteErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos eliminar la solicitud
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {deleteErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {pdfErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos abrir el PDF
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {pdfErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-950">
                    Datos de la solicitud
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {formatDateTime(request.submittedAt)}
                  </p>
                </div>

                <div className="w-full sm:w-auto sm:min-w-[18rem]">
                  <RequestManagementCard
                    key={`${request.id}:${request.updatedAt ?? request.status}`}
                    request={request}
                    isDeleting={isDeleting}
                    isGeneratingPdf={isGeneratingPdf}
                    isSaving={isSaving}
                    isSwitchingVersion={isSwitchingVersion}
                    pendingVersionCount={pendingVersionCount}
                    onDelete={() => void handleDelete()}
                    onOpenPdf={() => void handleOpenPdf()}
                    onOpenVersions={() => setIsVersionModalOpen(true)}
                    onSave={save}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="space-y-6">
                  <div>
                    <div className="grid gap-x-12 gap-y-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] lg:gap-x-16">
                      <RequestDetailField label="producto" value={request.title} />
                      <RequestDetailField label="Productora" value={companyName} />
                      <RequestDetailField
                        label="Inicio"
                        value={formatDisplayDate(tentativeStartDate)}
                      />
                      <RequestDetailField
                        label="Fin"
                        value={formatDisplayDate(tentativeEndDate)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                      <RequestDetailField
                        label="Nombre"
                        value={request.requester.fullName}
                      />
                      <RequestDetailField
                        label="Email"
                        value={request.requester.email}
                      />
                      <RequestDetailField
                        label="Teléfono"
                        value={request.requester.phone}
                      />
                    </div>
                  </div>

                  <ReadOnlyField label="Mensaje u observaciones">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {displayMessage || 'Sin mensaje'}
                    </p>
                  </ReadOnlyField>
                </div>
              </div>
            </div>
          </Card>

          <RequestIncludedLocationsTable
            locations={request.locations}
            product={request.title}
            productionCompany={request.productionCompany}
            tentativeStartDate={tentativeStartDate}
            tentativeEndDate={tentativeEndDate}
            onReservationCreated={reload}
          />
        </>
      ) : null}
    </PageContainer>
  )
}

export default AdminRequestDetailPage
