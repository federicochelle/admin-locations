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
  onDelete,
  onOpenPdf,
  request,
  onSave,
}: {
  isDeleting: boolean
  isGeneratingPdf: boolean
  isSaving: boolean
  onDelete: () => void
  onOpenPdf: () => void
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
          className={[inputClassName(), 'flex-1'].join(' ')}
        >
          {LOCATION_REQUEST_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onOpenPdf}
          disabled={isGeneratingPdf || isDeleting}
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
    isDeleting,
    errorMessage,
    saveErrorMessage,
    deleteErrorMessage,
    reload,
    save,
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
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null)
  const companyName = request?.productionCompany ?? null
  const tentativeStartDate = request?.tentativeStartDate ?? null
  const tentativeEndDate = request?.tentativeEndDate ?? null
  const displayMessage = request?.message ?? null

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

    const confirmed = window.confirm('¿Estás seguro que querés eliminar?')

    if (!confirmed) {
      return
    }

    const deleted = await remove()

    if (deleted) {
      navigate(routePaths.requests)
    }
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
                    onDelete={() => void handleDelete()}
                    onOpenPdf={() => void handleOpenPdf()}
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
            tentativeStartDate={tentativeStartDate}
            tentativeEndDate={tentativeEndDate}
            companyName={companyName}
            onReservationCreated={reload}
          />
        </>
      ) : null}
    </PageContainer>
  )
}

export default AdminRequestDetailPage
