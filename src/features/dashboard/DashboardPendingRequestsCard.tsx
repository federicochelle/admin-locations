import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getRequestDetailPath, routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { formatRelativeCreatedAt } from '../activity/activity-logs.helpers'
import {
  getAdminLocationRequests,
} from '../requests-admin/admin-location-requests.service'
import type {
  AdminLocationRequest,
} from '../requests-admin/admin-location-requests.types'

const DASHBOARD_PENDING_REQUESTS_LIMIT = 5

function getRequesterName(request: AdminLocationRequest) {
  const fullName = request.requesterFullName?.trim()

  if (fullName) {
    return fullName
  }

  return request.requesterEmail?.trim() || 'Usuario sin nombre'
}

function getPendingRequests(requests: AdminLocationRequest[]) {
  return requests.filter((request) => request.status === 'pending')
}

function DashboardPendingRequestsCard() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [requests, setRequests] = useState<AdminLocationRequest[]>([])

  async function loadRequests() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextRequests = await getAdminLocationRequests()
      setRequests(nextRequests)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las solicitudes pendientes.'

      setRequests([])
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getAdminLocationRequests()
      .then((nextRequests) => {
        if (!isActive) {
          return
        }

        setRequests(nextRequests)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las solicitudes pendientes.'

        setRequests([])
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

  const pendingRequests = useMemo(() => getPendingRequests(requests), [requests])
  const visibleRequests = pendingRequests.slice(0, DASHBOARD_PENDING_REQUESTS_LIMIT)

  return (
    <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
      <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm sm:rounded-t-2xl">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Solicitudes pendientes
          </h2>
        </div>

        <Link
          to={routePaths.requests}
          className="shrink-0 text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Cargando solicitudes pendientes...
        </p>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">{errorMessage}</p>
          <Button variant="secondary" onClick={() => void loadRequests()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && visibleRequests.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          No hay solicitudes pendientes.
        </p>
      ) : null}

      {!isLoading && !errorMessage && visibleRequests.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-200">
          {visibleRequests.map((request) => (
            <li
              key={request.id}
              className="cursor-pointer py-3 transition first:pt-0 last:pb-0 hover:bg-[rgba(184,146,74,0.08)]"
              onClick={() => navigate(getRequestDetailPath(request.id))}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-950">
                    {request.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {getRequesterName(request)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatRelativeCreatedAt(request.submittedAt)}
                  </p>
                </div>

                <span className="inline-flex w-fit shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Pendiente
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

export default DashboardPendingRequestsCard
