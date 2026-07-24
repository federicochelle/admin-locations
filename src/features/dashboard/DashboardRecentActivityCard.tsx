import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
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

const DASHBOARD_ACTIVITY_LIMIT = 5

function DashboardRecentActivityCard() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ActivityLogListItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadActivity() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextItems = await getActivityLogs({ limit: DASHBOARD_ACTIVITY_LIMIT })
      setItems(nextItems)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar la actividad reciente.'

      setItems([])
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getActivityLogs({ limit: DASHBOARD_ACTIVITY_LIMIT })
      .then((nextItems) => {
        if (!isActive) {
          return
        }

        setItems(nextItems)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar la actividad reciente.'

        setItems([])
        setErrorMessage(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return (
    <Card className="h-full">
      <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Actividad reciente
          </h2>
        </div>

        <Link
          to={routePaths.activity}
          className="shrink-0 text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline"
        >
          Ver historial
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Cargando actividad reciente...
        </p>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">{errorMessage}</p>
          <Button variant="secondary" onClick={() => void loadActivity()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          No encontramos actividad reciente todavía.
        </p>
      ) : null}

      {!isLoading && !errorMessage && items.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-200 text-sm leading-6 text-slate-600">
          {items.map((item) => (
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
    </Card>
  )
}

export default DashboardRecentActivityCard
