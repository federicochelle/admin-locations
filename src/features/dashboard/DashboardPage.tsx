import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import type { Profile } from '../auth/auth-context'
import useAuth from '../auth/useAuth'
import {
  formatActivityEntityName,
  formatRelativeCreatedAt,
  getActivityActionLabel,
  getActivityEntityPath,
} from '../activity/activity-logs.helpers'
import {
  getActivityLogs,
  type ActivityLogListItem,
} from '../activity/activity-logs.service'

type RecentActivityAudit = {
  items: ActivityLogListItem[]
  unavailableSources: string[]
}

async function loadRecentActivityAudit(): Promise<RecentActivityAudit> {
  const items = await getActivityLogs({ limit: 5 })

  return { items, unavailableSources: [] }
}

function getDashboardWelcomeTitle(
  profile: Profile | null,
  userMetadata: Record<string, unknown> | null | undefined,
  email: string | undefined,
) {
  const profileFullName = profile?.full_name?.trim() ?? ''

  if (profileFullName.length > 0) {
    return `Bienvenido al panel administrativo, ${profileFullName}!`
  }

  const profileEmail = profile?.email?.trim() ?? ''

  if (profileEmail.length > 0) {
    return `Bienvenido al Panel Administrativo, ${profileEmail}!`
  }

  const fullName =
    typeof userMetadata?.full_name === 'string' ? userMetadata.full_name.trim() : ''

  if (fullName.length > 0) {
    return `Bienvenido al Panel Administrativo, ${fullName}!`
  }

  const name = typeof userMetadata?.name === 'string' ? userMetadata.name.trim() : ''

  if (name.length > 0) {
    return `Bienvenido al panel administrativo, ${name}!`
  }

  if (email && email.trim().length > 0) {
    return `Bienvenido al panel administrativo, ${email}!`
  }

  return 'Bienvenido al panel administrativo'
}

function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser, profile } = useAuth()
  const [recentActivityItems, setRecentActivityItems] = useState<ActivityLogListItem[]>([])
  const [recentActivityIssues, setRecentActivityIssues] = useState<string[]>([])
  const [isRecentActivityLoading, setIsRecentActivityLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    void loadRecentActivityAudit()
      .then((result) => {
        if (!isActive) {
          return
        }

        setRecentActivityItems(result.items)
        setRecentActivityIssues(result.unavailableSources)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar la actividad reciente.'

        setRecentActivityItems([])
        setRecentActivityIssues([message])
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsRecentActivityLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  const welcomeTitle = useMemo(
    () =>
      getDashboardWelcomeTitle(
        profile,
        currentUser?.user_metadata,
        currentUser?.email,
      ),
    [currentUser?.email, currentUser?.user_metadata, profile],
  )

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: welcomeTitle }],
      title: welcomeTitle,
    }),
    [welcomeTitle],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title={welcomeTitle}
      description="Vista general del panel administrativo. Acá vamos a concentrar métricas, actividad reciente y accesos rápidos."
      hideHeader
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="-mx-6 -mt-6 rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Actividad reciente
            </h2>
          </div>
          {isRecentActivityLoading ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Cargando actividad reciente...
            </p>
          ) : null}
          {!isRecentActivityLoading && recentActivityItems.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-200 text-sm leading-6 text-slate-600">
              {recentActivityItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#B8924A]"
                  />
                  <div className="min-w-0">
                    <p>
                      <span>{item.actor_name || 'Alguien'} </span>
                      <span>{getActivityActionLabel(item.action)} </span>
                      {getActivityEntityPath(item) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const path = getActivityEntityPath(item)

                            if (path) {
                              navigate(path)
                            }
                          }}
                          className="font-medium text-slate-900 underline-offset-4 transition hover:cursor-pointer hover:underline"
                        >
                          {formatActivityEntityName(item)}
                        </button>
                      ) : (
                        <span>{formatActivityEntityName(item)}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRelativeCreatedAt(item.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {!isRecentActivityLoading &&
          recentActivityItems.length === 0 &&
          recentActivityIssues.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              No encontramos actividad reciente todavía.
            </p>
          ) : null}
          {!isRecentActivityLoading && recentActivityIssues.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm leading-6 text-slate-600">
                No pudimos usar todas las fuentes para la actividad reciente:
              </p>
              <ul className="space-y-2 text-sm leading-6 text-amber-700">
                {recentActivityIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <div className="-mx-6 -mt-6 rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estado del proyecto
            </h2>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Completado</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>✓ Dashboard</li>
                <li>✓ Locaciones</li>
                <li>✓ Dueños</li>
                <li>✓ Categorías</li>
                <li>✓ Zonas</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">En desarrollo</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>□ Solicitudes</li>
                <li>□ Propuestas</li>
                <li>□ Reservas</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Próximos módulos</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>□ Usuarios</li>
                <li>□ Suscripciones</li>
                <li>□ IA</li>
                <li>□ Reportes</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}

export default DashboardPage
