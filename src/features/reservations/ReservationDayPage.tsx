import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { getReservationDetailPath } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import {
  buildReservationPrefillValues,
  getReservationsForDay,
} from './reservation-calendar.helpers'
import ReservationDialog from './ReservationDialog'
import { useReservations } from './useReservations'
import type { ReservationFormValues, ReservationListItem } from './reservations.types'
import {
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
} from './reservations.types'

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function parseRouteDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function formatFullDate(date: Date) {
  const formatter = new Intl.DateTimeFormat('es-UY', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const label = formatter.format(date)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatTimeRange(reservation: ReservationListItem) {
  const formatter = new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${formatter.format(new Date(reservation.startsAt))} - ${formatter.format(new Date(reservation.endsAt))}`
}

function formatOwnerName(reservation: ReservationListItem) {
  return reservation.ownerName?.trim() || 'Sin dueño asignado'
}

function formatOwnerPhone(reservation: ReservationListItem) {
  return reservation.ownerPhone?.trim() || 'Sin teléfono'
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

function ReservationDayPage() {
  const navigate = useNavigate()
  const { date: dateParam } = useParams<{ date: string }>()
  const selectedDay = useMemo(() => parseRouteDate(dateParam), [dateParam])
  const {
    reservations,
    locationOptions,
    isLoading,
    isSaving,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    retry,
    create,
    update,
  } = useReservations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedDatePrefill, setSelectedDatePrefill] =
    useState<Partial<ReservationFormValues> | null>(null)
  const [dialogValidationError, setDialogValidationError] = useState<string | null>(null)
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationListItem | null>(null)

  const dayLabel = selectedDay ? formatFullDate(selectedDay) : 'Fecha inválida'
  const dayReservations = useMemo(
    () =>
      selectedDay
        ? getReservationsForDay(reservations, selectedDay).sort(
            (left, right) =>
              new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
          )
        : [],
    [reservations, selectedDay],
  )

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Reservas' },
        { label: dayLabel },
      ],
      title: dayLabel,
      description:
        selectedDay !== null
          ? `${dayReservations.length} ${dayReservations.length === 1 ? 'reserva registrada' : 'reservas registradas'} para esta fecha.`
          : 'La fecha solicitada no es válida.',
    }),
    [dayLabel, dayReservations.length, selectedDay],
  )

  useLayoutHeader(headerConfig)

  function handleOpenCreateDialog() {
    if (!selectedDay) {
      return
    }

    setDialogMode('create')
    setSelectedReservation(null)
    setSelectedDatePrefill(buildReservationPrefillValues(selectedDay))
    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleOpenReservationDetail(reservation: ReservationListItem) {
    if (!dateParam) {
      return
    }

    navigate(getReservationDetailPath(reservation.id), {
      state: {
        sourceDay: dateParam,
      },
    })
  }

  function handleCloseDialog() {
    if (isSaving) {
      return
    }

    setIsDialogOpen(false)
    setSelectedReservation(null)
    setSelectedDatePrefill(null)
    setDialogValidationError(null)
  }

  async function handleSubmit(values: ReservationFormValues) {
    const validationMessage = getDateRangeValidationMessage(values)

    if (validationMessage) {
      setDialogValidationError(validationMessage)
      return false
    }

    setDialogValidationError(null)

    const payload = {
      location_id: values.locationId,
      title: values.title.trim(),
      starts_at: toIsoDateTime(values.startsAt),
      ends_at: toIsoDateTime(values.endsAt),
      status: values.status,
      notes: values.notes.trim().length > 0 ? values.notes.trim() : null,
    }

    if (dialogMode === 'create') {
      return create(payload)
    }

    if (!selectedReservation) {
      return false
    }

    return update(selectedReservation.id, payload)
  }

  return (
    <PageContainer
      title="Reservas"
      description="Gestioná reservas administrativas para cada locación y mantené la ocupación actualizada."
      hideHeader
    >
      <ReservationDialog
        key={[
          dialogMode,
          selectedReservation?.id ?? 'new',
          selectedDatePrefill?.startsAt ?? '',
          selectedDatePrefill?.endsAt ?? '',
        ].join(':')}
        errorMessage={dialogValidationError ?? actionErrorMessage}
        initialValues={selectedDatePrefill}
        isOpen={isDialogOpen}
        isSubmitting={isSaving}
        locationOptions={locationOptions}
        mode={dialogMode}
        reservation={selectedReservation}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
      />

      {selectedDay !== null && isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando reservas...</p>
          </div>
        </Card>
      ) : null}

      {selectedDay !== null && !isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las reservas
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

      {selectedDay !== null && !isLoading && !errorMessage && actionErrorMessage && !isDialogOpen ? (
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos actualizar la reserva
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionErrorMessage}
            </p>
          </div>
        </Card>
      ) : null}

      {selectedDay !== null && !isLoading && !errorMessage && actionSuccessMessage ? (
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

      {selectedDay !== null && !isLoading && !errorMessage ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {dayLabel}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {`${dayReservations.length} ${dayReservations.length === 1 ? 'reserva registrada' : 'reservas registradas'}`}
                </p>
              </div>

              <div className="flex items-center justify-start lg:justify-end">
                <Button className="gap-2" onClick={handleOpenCreateDialog}>
                  <PlusIcon />
                  Nueva reserva
                </Button>
              </div>
            </div>
          </div>

          {dayReservations.length === 0 ? (
            <div className="px-4 py-6 sm:px-6 sm:py-8">
              <EmptyState
                title="No hay reservas para este día"
                description="Todavía no se registraron reservas para esta fecha. Podés crear una nueva desde acá."
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden md:block">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-[#f3f2ee]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                        Horario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                        Dueño
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {dayReservations.map((reservation) => (
                      <tr
                        key={reservation.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => handleOpenReservationDetail(reservation)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {formatTimeRange(reservation)}
                        </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {reservation.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">
                            {formatOwnerName(reservation)}
                          </p>
                          <p>
                            {formatOwnerPhone(reservation)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {reservation.locationCode?.replaceAll('-', ' ') || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                              getReservationStatusBadgeClassName(reservation.status),
                            ].join(' ')}
                          >
                            {getReservationStatusLabel(reservation.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 px-4 py-4 sm:px-6 md:hidden">
                {dayReservations.map((reservation) => (
                  <Card
                    key={reservation.id}
                    className="cursor-pointer p-4 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => handleOpenReservationDetail(reservation)}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {formatTimeRange(reservation)}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-slate-950">
                            {reservation.title}
                          </h3>
                        </div>
                        <span
                          className={[
                            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                            getReservationStatusBadgeClassName(reservation.status),
                          ].join(' ')}
                        >
                          {getReservationStatusLabel(reservation.status)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-900">Dueño:</span>{' '}
                          {formatOwnerName(reservation)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Teléfono:</span>{' '}
                          {formatOwnerPhone(reservation)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}
    </PageContainer>
  )
}

export default ReservationDayPage
