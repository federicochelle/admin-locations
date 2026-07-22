import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import {
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarConnectionStatus,
  type GoogleCalendarConnectionStatus,
} from './google-calendar.service'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function GoogleCalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        d="M7 3v3M17 3v3M4 9h16"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v11A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5Z"
        strokeWidth="1.8"
      />
      <path
        d="M8 13h3M8 16h8M14.5 12.5h.01"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SettingsPage() {
  const [searchParams] = useSearchParams()
  const [connection, setConnection] = useState<GoogleCalendarConnectionStatus | null>(
    null,
  )
  const [isLoadingConnection, setIsLoadingConnection] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const oauthFeedback = useMemo(() => {
    const status = searchParams.get('googleCalendar')
    const reason = searchParams.get('reason')

    if (status === 'success') {
      return {
        kind: 'success' as const,
        message: 'Google Calendar quedó conectado correctamente.',
      }
    }

    if (status === 'error') {
      if (reason === 'oauth_denied') {
        return {
          kind: 'error' as const,
          message: 'La conexión con Google Calendar fue cancelada o rechazada.',
        }
      }

      return {
        kind: 'error' as const,
        message: 'No pudimos completar la conexión con Google Calendar.',
      }
    }

    return null
  }, [searchParams])

  useEffect(() => {
    let isActive = true

    void getGoogleCalendarConnectionStatus()
      .then((nextConnection) => {
        if (!isActive) {
          return
        }

        setConnection(nextConnection)
        setConnectionError(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setConnectionError(
          error instanceof Error
            ? error.message
            : 'No pudimos cargar el estado de Google Calendar.',
        )
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoadingConnection(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  async function handleConnectGoogleCalendar() {
    try {
      setIsConnecting(true)
      setConnectionError(null)

      const authorizationUrl = await getGoogleCalendarAuthorizationUrl()
      window.location.assign(authorizationUrl)
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : 'No pudimos iniciar la conexión con Google Calendar.',
      )
      setIsConnecting(false)
    }
  }

  return (
    <PageContainer
      title="Configuración"
      description="Área reservada para parámetros generales del panel y catálogos secundarios que necesiten administración."
    >
      {oauthFeedback ? (
        <Card
          className={
            oauthFeedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50/90'
              : 'border-red-200 bg-red-50/90'
          }
        >
          <p
            className={
              oauthFeedback.kind === 'success'
                ? 'text-sm font-medium text-emerald-700'
                : 'text-sm font-medium text-red-700'
            }
          >
            {oauthFeedback.message}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">
          Configuración general
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Acá podremos ubicar más adelante ajustes operativos, taxonomías y
          configuraciones complementarias del sistema.
        </p>
      </Card>

      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <GoogleCalendarIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Google Calendar
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Conectá una cuenta de Google para preparar la futura sincronización
                de eventos desde el panel administrador.
              </p>
            </div>
          </div>

          <div className="lg:shrink-0">
            <Button
              type="button"
              disabled={isLoadingConnection || isConnecting}
              onClick={() => void handleConnectGoogleCalendar()}
            >
              {isConnecting ? 'Abriendo Google...' : 'Conectar Google Calendar'}
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Estado</span>
            <span
              className={[
                'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                connection?.connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600',
              ].join(' ')}
            >
              {isLoadingConnection
                ? 'Cargando...'
                : connection?.connected
                  ? 'Conectado'
                  : 'Desconectado'}
            </span>
          </div>

          {connectionError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {connectionError}
            </div>
          ) : null}

          {connection?.connected ? (
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cuenta conectada
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {connection.googleAccountEmail}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Fecha de conexión
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {formatDateTime(connection.connectedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Última actualización
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {formatDateTime(connection.updatedAt)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              Todavía no hay ninguna cuenta de Google Calendar conectada para este
              panel.
            </p>
          )}
        </div>
      </Card>
    </PageContainer>
  )
}

export default SettingsPage
