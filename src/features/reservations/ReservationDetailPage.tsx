import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import {
  getLocationDetailPath,
  getReservationDayPath,
  routePaths,
} from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import { getOwnerWhatsappUrl } from '../../lib/phone'
import ReservationDialog from './ReservationDialog'
import { useReservations } from './useReservations'
import type { ReservationFormValues } from './reservations.types'
import {
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
} from './reservations.types'

type ReservationNavigationState = {
  sourceDay?: string
}

function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString()
}

function getDateRangeValidationMessage(values: ReservationFormValues) {
  if (!values.startsAt || !values.endsAt) {
    return 'La fecha y hora de fin deben ser posteriores al inicio.'
  }

  const startDate = new Date(values.startsAt)
  const endDate = new Date(values.endsAt)

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate.getTime() <= startDate.getTime()
  ) {
    return 'La fecha y hora de fin deben ser posteriores al inicio.'
  }

  return null
}

function formatReservationDateLabel(value: string) {
  const label = new Intl.DateTimeFormat('es-UY', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function InfoRow({
  href,
  icon,
  rel,
  target,
  value,
}: {
  href?: string | null
  icon: React.ReactNode
  rel?: string
  target?: string
  value: string | null | undefined
}) {
  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
        {icon}
      </span>
      <span>{formatOptionalField(value)}</span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className="flex items-center gap-3 text-sm font-medium leading-6 text-slate-700 underline-offset-4 transition hover:text-slate-950 hover:underline"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm font-medium leading-6 text-slate-700">
      {content}
    </div>
  )
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 20h9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" strokeWidth="1.8" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="M20 21a8 8 0 0 0-16 0"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8" r="4" strokeWidth="1.8" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5A2 2 0 0 1 22 16.9Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="m20 13-7 7-10-10V3h7l10 10Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 2v4M16 2v4M3 10h18"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path
        d="M12 7v5l3 2"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 3h8l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3v5h5M10 13h4M10 17h6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ReservationDetailPage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const routerLocation = useLocation()
  const navigationState = (routerLocation.state as ReservationNavigationState | null) ?? null
  const sourceDay = navigationState?.sourceDay?.trim() || null
  const {
    reservations,
    locationOptions,
    isLoading,
    isSaving,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    retry,
    update,
  } = useReservations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogValidationError, setDialogValidationError] = useState<string | null>(null)

  const reservation = useMemo(
    () =>
      reservationId
        ? reservations.find((item) => item.id === reservationId) ?? null
        : null,
    [reservationId, reservations],
  )

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Reservas', to: routePaths.reservations },
        ...(sourceDay
          ? [{ label: sourceDay, to: getReservationDayPath(sourceDay) }]
          : []),
        { label: reservation?.title ?? 'Detalle de reserva' },
      ],
      title: reservation?.title ?? 'Detalle de reserva',
      description:
        'Revisá la información de la reserva, su locación asociada y actualizá sus datos si hace falta.',
    }),
    [reservation, sourceDay],
  )

  useLayoutHeader(headerConfig)

  const locationDetailHref = reservation ? getLocationDetailPath(reservation.locationId) : null
  const googleMapsHref = reservation?.formattedAddress?.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(reservation.formattedAddress)}`
    : null
  const whatsappHref = reservation?.ownerPhone
    ? getOwnerWhatsappUrl(reservation.ownerPhone)
    : null

  function handleOpenEditDialog() {
    if (!reservation) {
      return
    }

    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleCloseDialog() {
    if (isSaving) {
      return
    }

    setIsDialogOpen(false)
    setDialogValidationError(null)
  }

  async function handleSubmit(values: ReservationFormValues) {
    const validationMessage = getDateRangeValidationMessage(values)

    if (validationMessage) {
      setDialogValidationError(validationMessage)
      return false
    }

    if (!reservation) {
      return false
    }

    setDialogValidationError(null)

    return update(reservation.id, {
      location_id: values.locationId,
      title: values.title.trim(),
      starts_at: toIsoDateTime(values.startsAt),
      ends_at: toIsoDateTime(values.endsAt),
      status: values.status,
      notes: values.notes.trim().length > 0 ? values.notes.trim() : null,
    })
  }

  return (
    <PageContainer
      title="Detalle de reserva"
      description="Revisá la información de la reserva y su locación asociada."
      hideHeader
    >
      <ReservationDialog
        key={reservation?.id ?? 'missing'}
        errorMessage={dialogValidationError ?? actionErrorMessage}
        isOpen={isDialogOpen}
        isSubmitting={isSaving}
        locationOptions={locationOptions}
        mode="edit"
        reservation={reservation}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
      />

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando reserva...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar la reserva
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && !reservation ? (
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No encontramos la reserva
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              La reserva que intentaste abrir no existe o ya no está disponible.
            </p>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && reservation ? (
        <>
          {actionErrorMessage && !isDialogOpen ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos guardar los cambios
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {actionErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {actionSuccessMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Operación completada
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {actionSuccessMessage}
                </p>
              </div>
            </Card>
          ) : null}

          <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
            <div>
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      Detalle de reserva
                    </h3>
                    <span
                      className={[
                        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                        getReservationStatusBadgeClassName(reservation.status),
                      ].join(' ')}
                    >
                      {getReservationStatusLabel(reservation.status)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenEditDialog}
                    aria-label="Editar"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
                  >
                    <EditIcon />
                  </button>
                </div>
              </div>

              <div className="space-y-8 p-5 sm:p-6">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-stretch">
                    {reservation.coverImageUrl ? (
                      <div className="overflow-hidden">
                        <img
                          src={reservation.coverImageUrl}
                          alt={`Portada de ${reservation.locationTitle}`}
                          className="h-56 w-full object-cover lg:h-full"
                        />
                      </div>
                    ) : (
                      <div className="flex h-56 w-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-400 lg:h-full">
                        Sin imagen de portada
                      </div>
                    )}

                    <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                      <div className="space-y-3">
                        <InfoRow
                          icon={<TagIcon />}
                          value={reservation.locationCode || reservation.locationTitle}
                          href={locationDetailHref}
                        />
                        <InfoRow
                          icon={<PinIcon />}
                          value={reservation.formattedAddress || 'Dirección no disponible'}
                          href={googleMapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                        <InfoRow
                          icon={<UserIcon />}
                          value={reservation.ownerName || 'Sin dueño asignado'}
                        />
                        <InfoRow
                          icon={<PhoneIcon />}
                          value={reservation.ownerPhone || 'Sin teléfono'}
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      </div>

                      <div className="space-y-4 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Fecha de la reserva
                        </p>
                        <InfoRow
                          icon={<CalendarIcon />}
                          value={formatReservationDateLabel(reservation.startsAt)}
                        />
                        <InfoRow
                          icon={<ClockIcon />}
                          value={`${formatTime(reservation.startsAt)} → ${formatTime(reservation.endsAt)}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="flex h-5 w-5 items-center justify-center">
                      <NoteIcon />
                    </span>
                    <span>Notas</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {reservation.notes?.trim() || 'Sin notas'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}

export default ReservationDetailPage
