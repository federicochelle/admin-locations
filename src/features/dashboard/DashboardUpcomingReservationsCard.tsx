import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import {
  formatReservationDateTime,
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
  type ReservationListItem,
} from '../reservations/reservations.types'
import { getReservations } from '../reservations/reservations.service'

const DASHBOARD_UPCOMING_RESERVATIONS_LIMIT = 5

function formatReservationLocation(reservation: ReservationListItem) {
  return reservation.locationCode?.trim()
    ? `${reservation.locationCode.replaceAll('-', ' ')} · ${reservation.locationTitle}`
    : reservation.locationTitle
}

function getUpcomingReservations(reservations: ReservationListItem[]) {
  const now = Date.now()

  return reservations
    .filter((reservation) => {
      const startsAt = new Date(reservation.startsAt).getTime()

      return !Number.isNaN(startsAt) && startsAt >= now
    })
    .sort(
      (leftReservation, rightReservation) =>
        new Date(leftReservation.startsAt).getTime() -
        new Date(rightReservation.startsAt).getTime(),
    )
}

function DashboardUpcomingReservationsCard() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reservations, setReservations] = useState<ReservationListItem[]>([])

  async function loadReservations() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextReservations = await getReservations()
      setReservations(nextReservations)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las próximas reservas.'

      setReservations([])
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getReservations()
      .then((nextReservations) => {
        if (!isActive) {
          return
        }

        setReservations(nextReservations)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las próximas reservas.'

        setReservations([])
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

  const upcomingReservations = useMemo(
    () => getUpcomingReservations(reservations),
    [reservations],
  )
  const visibleReservations = upcomingReservations.slice(
    0,
    DASHBOARD_UPCOMING_RESERVATIONS_LIMIT,
  )

  return (
    <Card className="h-full">
      <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Próximas reservas
          </h2>
        </div>

        <Link
          to={routePaths.reservations}
          className="shrink-0 text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline"
        >
          Ver calendario
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Cargando próximas reservas...
        </p>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">{errorMessage}</p>
          <Button variant="secondary" onClick={() => void loadReservations()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && visibleReservations.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          No hay próximas reservas.
        </p>
      ) : null}

      {!isLoading && !errorMessage && visibleReservations.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-200">
          {visibleReservations.map((reservation) => (
            <li
              key={reservation.id}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-950">
                  {formatReservationDateTime(reservation.startsAt)}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatReservationLocation(reservation)}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {reservation.title}
                </p>
              </div>

              <span
                className={[
                  'inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold',
                  getReservationStatusBadgeClassName(reservation.status),
                ].join(' ')}
              >
                {getReservationStatusLabel(reservation.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

export default DashboardUpcomingReservationsCard
