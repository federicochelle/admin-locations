import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import {
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarConnectionStatus,
  type GoogleCalendarConnectionStatus,
} from './google-calendar.service'
import {
  getSettingsConnectionDetailById,
  getSettingsConnectionDetailByName,
  updateSettingsConnection,
} from './settings.service'
import {
  getIntegrationBillingCycleLabel,
  getIntegrationStatusLabel,
  SETTINGS_CONNECTION_BILLING_CYCLE_OPTIONS,
  SETTINGS_CONNECTION_STATUS_OPTIONS,
  type IntegrationBillingCycle,
  type IntegrationStatus,
  type SettingsConnectionDetail,
  type SettingsConnectionUpdateInput,
} from './settings.types'

type SettingsConnectionDetailPageProps = {
  integrationName?: string
}

type ConnectionViewState = {
  connectedAt: string | null
  googleAccountEmail: string | null
  isConnected: boolean
  updatedAt: string | null
}

type FormValues = {
  billingAmount: string
  billingCycle: IntegrationBillingCycle | ''
  billingCycleEnd: string
  billingCycleStart: string
  name: string
  status: 'configured' | 'pending' | 'error'
}

function fieldLabelClassName() {
  return 'mb-2 block text-sm font-medium text-slate-700'
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'
}

function plainValueClassName() {
  return 'min-h-11 rounded-xl bg-transparent px-0 py-2.5 text-sm font-medium leading-6 text-slate-900'
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getConnectionStatusBadgeClassName(isConnected: boolean) {
  return isConnected
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
}

function getIntegrationStatusBadgeClassName(status: IntegrationStatus) {
  if (status === 'connected') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'configured' || status === 'active') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (status === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function normalizeGoogleConnectionState(connection: GoogleCalendarConnectionStatus | null): ConnectionViewState {
  if (!connection) {
    return {
      connectedAt: null,
      googleAccountEmail: null,
      isConnected: false,
      updatedAt: null,
    }
  }

  return {
    connectedAt: connection.connectedAt,
    googleAccountEmail: connection.googleAccountEmail,
    isConnected: connection.connected,
    updatedAt: connection.updatedAt,
  }
}

function getEditableStatus(status: IntegrationStatus): FormValues['status'] {
  if (status === 'error') {
    return 'error'
  }

  if (status === 'pending') {
    return 'pending'
  }

  return 'configured'
}

function mapDetailToFormValues(detail: SettingsConnectionDetail): FormValues {
  return {
    name: detail.name,
    status: getEditableStatus(detail.status),
    billingAmount: detail.billingAmount,
    billingCycle: detail.billingCycle ?? '',
    billingCycleStart: detail.billingCycleStart,
    billingCycleEnd: detail.billingCycleEnd,
  }
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium leading-6 text-slate-900">{value}</div>
    </div>
  )
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5Z" />
    </svg>
  )
}

function getDisplayValue(value: string) {
  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : '—'
}

function getDisplayBillingAmount(value: string) {
  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? `USD ${normalizedValue}` : '—'
}

function shouldHideBillingFieldsInEditMode(billingCycle: FormValues['billingCycle']) {
  return billingCycle === 'free'
}

function shouldShowEmptyBillingFieldsInDetailMode(
  billingCycle: SettingsConnectionDetail['billingCycle'],
) {
  return billingCycle === 'free'
}

function SettingsConnectionDetailPage({
  integrationName,
}: SettingsConnectionDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<SettingsConnectionDetail | null>(null)
  const [formValues, setFormValues] = useState<FormValues | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionViewState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Configuración', to: routePaths.settings },
        { label: detail?.name ?? integrationName ?? 'Conexión' },
      ],
      title: detail?.name ?? integrationName ?? 'Conexión',
      description: 'Revisá y actualizá la configuración de esta integración.',
    }),
    [detail?.name, integrationName],
  )

  useLayoutHeader(headerConfig)

  async function loadDetail() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextDetail = id
        ? await getSettingsConnectionDetailById(id)
        : integrationName
          ? await getSettingsConnectionDetailByName(integrationName)
          : null

      if (!nextDetail) {
        throw new Error('No encontramos la integración solicitada.')
      }

      setDetail(nextDetail)
      setFormValues(mapDetailToFormValues(nextDetail))
      setIsEditing(false)
      setSaveErrorMessage(null)

      if (nextDetail.isGoogleCalendar) {
        const googleConnection = await getGoogleCalendarConnectionStatus()
        setConnectionState(normalizeGoogleConnectionState(googleConnection))
      } else {
        setConnectionState(null)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos cargar el detalle de la integración.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!detail || !formValues) {
      return
    }

    try {
      setIsSaving(true)
      setSaveErrorMessage(null)

      const payload: SettingsConnectionUpdateInput = {
        name: formValues.name,
        billingAmount: hidesBillingFieldsInEditMode ? '' : formValues.billingAmount,
        billingCycle: formValues.billingCycle || null,
        billingCycleStart: hidesBillingFieldsInEditMode ? '' : formValues.billingCycleStart,
        billingCycleEnd: hidesBillingFieldsInEditMode ? '' : formValues.billingCycleEnd,
      }

      if (!detail.isGoogleCalendar) {
        payload.status = formValues.status
      }

      const updatedDetail = await updateSettingsConnection(detail.id, payload)
      setDetail(updatedDetail)
      setFormValues(mapDetailToFormValues(updatedDetail))
      setIsEditing(false)
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar los cambios de la integración.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReconnect() {
    try {
      setIsConnecting(true)
      const authorizationUrl = await getGoogleCalendarAuthorizationUrl()
      window.location.assign(authorizationUrl)
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos iniciar la conexión con Google Calendar.',
      )
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    void loadDetail()
  }, [id, integrationName])

  const pageTitle = detail?.name ?? integrationName ?? 'Conexión'
  const googleState = connectionState ?? normalizeGoogleConnectionState(null)
  const googleActionLabel = googleState.isConnected ? 'Reconectar' : 'Conectar Google Calendar'
  const hidesBillingFieldsInEditMode = shouldHideBillingFieldsInEditMode(formValues?.billingCycle ?? '')
  const showsEmptyBillingFieldsInDetailMode = shouldShowEmptyBillingFieldsInDetailMode(
    detail?.billingCycle ?? null,
  )

  function handleEnterEditMode() {
    if (!detail) {
      return
    }

    setFormValues(mapDetailToFormValues(detail))
    setSaveErrorMessage(null)
    setIsEditing(true)
  }

  function handleCancelEdit() {
    if (!detail) {
      return
    }

    setFormValues(mapDetailToFormValues(detail))
    setSaveErrorMessage(null)
    setIsEditing(false)
  }

  if (!id && !integrationName) {
    return (
      <PageContainer
        title="Conexión"
        description="Revisá y actualizá la configuración de esta integración."
        hideHeader
      >
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar la integración
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No encontramos el identificador de la integración.
            </p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={pageTitle}
      description="Revisá y actualizá la configuración de esta integración."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando integración...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar la integración
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{errorMessage}</p>
            </div>
            <Button variant="secondary" onClick={() => void loadDetail()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && detail && formValues ? (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {detail.name}
                    </h2>
                    {!isEditing ? (
                      <span
                        className={[
                          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                          getIntegrationStatusBadgeClassName(detail.status),
                        ].join(' ')}
                      >
                        {getIntegrationStatusLabel(detail.status)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!isEditing ? (
                  <Button
                    variant="secondary"
                    onClick={handleEnterEditMode}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
                  >
                    <EditIcon />
                  </Button>
                ) : null}
              </div>

              {saveErrorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveErrorMessage}
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-5">
                  <div>
                    <p className={fieldLabelClassName()}>
                      Facturación
                    </p>
                    {isEditing ? (
                      <select
                        id="settings-connection-billing"
                        value={formValues.billingCycle}
                        onChange={(event) =>
                          setFormValues((current) =>
                            current
                              ? {
                                  ...current,
                                  billingCycle: event.target.value as FormValues['billingCycle'],
                                }
                              : current,
                          )
                        }
                        disabled={isSaving}
                        className={inputClassName()}
                      >
                        <option value="">Seleccionar</option>
                        {SETTINGS_CONNECTION_BILLING_CYCLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className={plainValueClassName()}>
                        {getIntegrationBillingCycleLabel(detail.billingCycle)}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className={fieldLabelClassName()}>
                      Importe
                    </p>
                    {isEditing ? (
                      hidesBillingFieldsInEditMode ? null : (
                        <input
                          id="settings-connection-billing-amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={formValues.billingAmount}
                          onChange={(event) =>
                            setFormValues((current) =>
                              current
                                ? {
                                    ...current,
                                    billingAmount: event.target.value,
                                  }
                                : current,
                            )
                          }
                          disabled={isSaving}
                          className={inputClassName()}
                        />
                      )
                    ) : (
                      <div className={plainValueClassName()}>
                        {showsEmptyBillingFieldsInDetailMode
                          ? '—'
                          : getDisplayBillingAmount(detail.billingAmount)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {isEditing ? (
                    <div>
                      <p className={fieldLabelClassName()}>
                        Estado
                      </p>
                      {detail.isGoogleCalendar ? (
                        <input
                          id="settings-connection-status"
                          value={getIntegrationStatusLabel(detail.status)}
                          disabled
                          className={inputClassName()}
                        />
                      ) : (
                        <select
                          id="settings-connection-status"
                          value={formValues.status}
                          onChange={(event) =>
                            setFormValues((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.target.value as FormValues['status'],
                                  }
                                : current,
                            )
                          }
                          disabled={isSaving}
                          className={inputClassName()}
                        >
                          {SETTINGS_CONNECTION_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : null}

                  <div>
                    <p className={fieldLabelClassName()}>
                      Inicio de facturación
                    </p>
                    {isEditing ? (
                      hidesBillingFieldsInEditMode ? null : (
                        <input
                          id="settings-connection-billing-start"
                          type="date"
                          value={formValues.billingCycleStart}
                          onChange={(event) =>
                            setFormValues((current) =>
                              current
                                ? {
                                    ...current,
                                    billingCycleStart: event.target.value,
                                  }
                                : current,
                            )
                          }
                          disabled={isSaving}
                          className={inputClassName()}
                        />
                      )
                    ) : (
                      <div className={plainValueClassName()}>
                        {showsEmptyBillingFieldsInDetailMode
                          ? '—'
                          : getDisplayValue(detail.billingCycleStart)}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className={fieldLabelClassName()}>
                      Fin de facturación
                    </p>
                    {isEditing ? (
                      hidesBillingFieldsInEditMode ? null : (
                        <input
                          id="settings-connection-billing-end"
                          type="date"
                          value={formValues.billingCycleEnd}
                          onChange={(event) =>
                            setFormValues((current) =>
                              current
                                ? {
                                    ...current,
                                    billingCycleEnd: event.target.value,
                                  }
                                : current,
                            )
                          }
                          disabled={isSaving}
                          className={inputClassName()}
                        />
                      )
                    ) : (
                      <div className={plainValueClassName()}>
                        {showsEmptyBillingFieldsInDetailMode
                          ? '—'
                          : getDisplayValue(detail.billingCycleEnd)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {detail.isGoogleCalendar ? (
            <Card>
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                      Estado real de conexión
                    </h2>
                    <span
                      className={[
                        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                        getConnectionStatusBadgeClassName(googleState.isConnected),
                      ].join(' ')}
                    >
                      {googleState.isConnected ? 'Conectado' : 'Pendiente'}
                    </span>
                  </div>

                  <Button onClick={() => void handleReconnect()} disabled={isConnecting || isSaving}>
                    {isConnecting ? 'Conectando...' : googleActionLabel}
                  </Button>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <DetailField
                    label="Cuenta conectada"
                    value={googleState.googleAccountEmail?.trim() || 'Sin conectar'}
                  />
                  <DetailField
                    label="Conectado desde"
                    value={formatDateTime(googleState.connectedAt)}
                  />
                  <DetailField
                    label="Última actualización"
                    value={formatDateTime(googleState.updatedAt)}
                  />
                </div>
              </div>
            </Card>
          ) : null}

          {isEditing ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={isSaving || isConnecting} className="sm:order-2">
                {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancelEdit}
                disabled={isSaving || isConnecting}
                className="sm:order-1"
              >
                Cancelar
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </PageContainer>
  )
}

export default SettingsConnectionDetailPage
