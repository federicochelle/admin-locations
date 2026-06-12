import { useEffect, useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import { getSupabaseClient } from '../../lib/supabase'

type RecentActivityItem = {
  createdAt: string
  entityLabel: 'Locación' | 'Dueño' | 'Categoría' | 'Zona'
  message: string
}

type RecentActivityAudit = {
  items: RecentActivityItem[]
  unavailableSources: string[]
}

type RecentLocationRow = {
  title: string | null
  created_at: string | null
}

type RecentOwnerRow = {
  full_name: string | null
  created_at: string | null
}

type RecentCategoryRow = {
  name: string | null
  created_at: string | null
}

type RecentZoneRow = {
  name: string | null
  created_at: string | null
}

function formatRelativeCreatedAt(value: string) {
  const createdAt = new Date(value)
  const diffMs = Date.now() - createdAt.getTime()

  if (Number.isNaN(createdAt.getTime()) || diffMs < 0) {
    return 'Hace instantes'
  }

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute))
    return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  }

  const days = Math.floor(diffMs / day)
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`
}

async function loadRecentActivityAudit(): Promise<RecentActivityAudit> {
  const supabase = getSupabaseClient()

  const [locationsResult, ownersResult, categoriesResult, zonesResult] =
    await Promise.all([
      supabase
        .from('locations')
        .select('title, created_at')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('owners')
        .select('full_name, created_at')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('categories')
        .select('name, created_at')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('zones')
        .select('name, created_at')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const unavailableSources: string[] = []
  const items: RecentActivityItem[] = []

  if (locationsResult.error) {
    unavailableSources.push(`locations: ${locationsResult.error.message}`)
  } else {
    const rows = (locationsResult.data ?? []) as RecentLocationRow[]
    items.push(
      ...rows
        .filter((row) => row.title && row.created_at)
        .map((row) => ({
          createdAt: row.created_at as string,
          entityLabel: 'Locación' as const,
          message: `Locación creada: ${row.title}`,
        })),
    )
  }

  if (ownersResult.error) {
    unavailableSources.push(`owners: ${ownersResult.error.message}`)
  } else {
    const rows = (ownersResult.data ?? []) as RecentOwnerRow[]
    items.push(
      ...rows
        .filter((row) => row.full_name && row.created_at)
        .map((row) => ({
          createdAt: row.created_at as string,
          entityLabel: 'Dueño' as const,
          message: `Dueño creado: ${row.full_name}`,
        })),
    )
  }

  if (categoriesResult.error) {
    unavailableSources.push(`categories: ${categoriesResult.error.message}`)
  } else {
    const rows = (categoriesResult.data ?? []) as RecentCategoryRow[]
    items.push(
      ...rows
        .filter((row) => row.name && row.created_at)
        .map((row) => ({
          createdAt: row.created_at as string,
          entityLabel: 'Categoría' as const,
          message: `Categoría creada: ${row.name}`,
        })),
    )
  }

  if (zonesResult.error) {
    unavailableSources.push(`zones: ${zonesResult.error.message}`)
  } else {
    const rows = (zonesResult.data ?? []) as RecentZoneRow[]
    items.push(
      ...rows
        .filter((row) => row.name && row.created_at)
        .map((row) => ({
          createdAt: row.created_at as string,
          entityLabel: 'Zona' as const,
          message: `Zona creada: ${row.name}`,
        })),
    )
  }

  const recentItems = [...items]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)

  return {
    items: recentItems,
    unavailableSources,
  }
}

function DashboardPage() {
  const [recentActivityItems, setRecentActivityItems] = useState<RecentActivityItem[]>([])
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

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Bienvenido al Panel Administrativo' }],
      title: 'Bienvenido al Panel Administrativo',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Bienvenido al Panel Administrativo"
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
                  key={`${item.entityLabel}-${item.createdAt}-${item.message}`}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#B8924A]"
                  />
                  <div className="min-w-0">
                    <p>{item.message}</p>
                    <p className="text-xs text-slate-500">
                      {formatRelativeCreatedAt(item.createdAt)}
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
