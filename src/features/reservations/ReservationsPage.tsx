import { useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import {
  buildReservationPrefillValues,
  startOfMonth,
} from './reservation-calendar.helpers'
import ReservationDialog from './ReservationDialog'
import ReservationsCalendar from './ReservationsCalendar'
import ReservationTable from './ReservationTable'
import ReservationViewToggle from './ReservationViewToggle'
import { useReservations } from './useReservations'
import type { ReservationFormValues, ReservationListItem } from './reservations.types'

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

function ReservationsPage() {
  const {
    reservations,
    locationOptions,
    isLoading,
    isSaving,
    errorMessage,
    actionErrorMessage,
    actionSuccessMessage,
    activeActionKey,
    retry,
    create,
    update,
    remove,
  } = useReservations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedDatePrefill, setSelectedDatePrefill] =
    useState<Partial<ReservationFormValues> | null>(null)
  const [dialogValidationError, setDialogValidationError] = useState<string | null>(null)
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationListItem | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [activeView, setActiveView] = useState<'calendar' | 'list'>('calendar')

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Reservas' }],
      title: 'Reservas',
      description:
        'Gestioná reservas administrativas para cada locación y mantené la ocupación actualizada.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  function handleOpenCreateDialog() {
    setDialogMode('create')
    setSelectedReservation(null)
    setSelectedDatePrefill(null)
    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleOpenCreateDialogForDay(day: Date) {
    setDialogMode('create')
    setSelectedReservation(null)
    setSelectedDatePrefill(buildReservationPrefillValues(day))
    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleOpenEditDialog(reservation: ReservationListItem) {
    setDialogMode('edit')
    setSelectedReservation(reservation)
    setSelectedDatePrefill(null)
    setDialogValidationError(null)
    setIsDialogOpen(true)
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

  async function handleDelete(reservation: ReservationListItem) {
    const shouldDelete = window.confirm(
      `¿Seguro que querés eliminar la reserva "${reservation.title}"?`,
    )

    if (!shouldDelete) {
      return
    }

    await remove(reservation)
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

  const reservationHeaderActions = (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <ReservationViewToggle
        value={activeView}
        onChange={setActiveView}
      />
      <Button className="gap-2" onClick={handleOpenCreateDialog}>
        <PlusIcon />
        Nueva reserva
      </Button>
    </div>
  )

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

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando reservas...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
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

      {!isLoading && !errorMessage && actionErrorMessage && !isDialogOpen ? (
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

      {!isLoading && !errorMessage && actionSuccessMessage ? (
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

      {!isLoading && !errorMessage && reservations.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay reservas cargadas"
            description="Cuando crees nuevas reservas para las locaciones, aparecerán acá."
          />
          <div className="mt-4 flex justify-center">
            <Button onClick={handleOpenCreateDialog}>
              Nueva reserva
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && reservations.length > 0 ? (
        <>
          {activeView === 'calendar' ? (
            <ReservationsCalendar
              currentMonth={currentMonth}
              headerActions={reservationHeaderActions}
              onMonthChange={(date) => setCurrentMonth(startOfMonth(date))}
              onOpenReservation={handleOpenEditDialog}
              onSelectDay={handleOpenCreateDialogForDay}
              reservations={reservations}
            />
          ) : (
            <ReservationTable
              activeActionKey={activeActionKey}
              headerActions={reservationHeaderActions}
              onDelete={handleDelete}
              onEdit={handleOpenEditDialog}
              reservations={reservations}
            />
          )}
        </>
      ) : null}
    </PageContainer>
  )
}

export default ReservationsPage
