import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useAdminFeedback } from '../../components/ui/admin-feedback/useAdminFeedback'
import PageContainer from '../../components/ui/PageContainer'
import {
  startOfMonth,
} from './reservation-calendar.helpers'
import ReservationDialog from './ReservationDialog'
import ReservationsCalendar from './ReservationsCalendar'
import ReservationTable from './ReservationTable'
import ReservationViewToggle from './ReservationViewToggle'
import { useReservations } from './useReservations'
import type { ReservationFormValues, ReservationListItem } from './reservations.types'
import {
  getReservationDayPath,
  getReservationDetailPath,
} from '../../app/router/route-paths'

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

function toRouteDate(day: Date) {
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
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

type ReservationCrudFeedback =
  | {
      kind: 'success'
      title: string
    }
  | {
      kind: 'warning'
      title: string
      description: string
    }

function getReservationCrudErrorDescription(
  error: unknown,
  fallbackMessage: string,
) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : fallbackMessage

  if (message.includes('Google Calendar')) {
    return 'No pudimos completar la operación por un problema de sincronización con Google Calendar. Revisá la conexión e intentá nuevamente.'
  }

  return message
}

function ReservationsPage() {
  const navigate = useNavigate()
  const { alert, confirm, showError, withLoading } = useAdminFeedback()
  const {
    reservations,
    locationOptions,
    isLoading,
    isSaving,
    errorMessage,
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
  const [pendingFeedback, setPendingFeedback] = useState<ReservationCrudFeedback | null>(null)

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

  useEffect(() => {
    if (isDialogOpen || !pendingFeedback) {
      return
    }

    void (async () => {
      if (pendingFeedback.kind === 'warning') {
        await alert({
          variant: 'warning',
          title: pendingFeedback.title,
          description: pendingFeedback.description,
          closeLabel: 'Entendido',
        })
      } else {
        await alert({
          variant: 'success',
          title: pendingFeedback.title,
          hideProgressBar: true,
          hideProgressPercentage: true,
          iconVariant: 'success',
          progressPercentage: 100,
          closeLabel: 'Entendido',
        })
      }

      setPendingFeedback(null)
    })()
  }, [alert, isDialogOpen, pendingFeedback])

  function handleOpenCreateDialog() {
    setDialogMode('create')
    setSelectedReservation(null)
    setSelectedDatePrefill(null)
    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleOpenDayDetail(day: Date) {
    navigate(getReservationDayPath(toRouteDate(day)))
  }

  function handleOpenEditDialog(reservation: ReservationListItem) {
    setDialogMode('edit')
    setSelectedReservation(reservation)
    setSelectedDatePrefill(null)
    setDialogValidationError(null)
    setIsDialogOpen(true)
  }

  function handleOpenReservationDetail(reservation: ReservationListItem) {
    navigate(getReservationDetailPath(reservation.id))
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
    const shouldDelete = await confirm({
      variant: 'danger',
      title: 'Eliminar reserva',
      description: `¿Seguro que querés eliminar la reserva "${reservation.title}"?`,
      confirmLabel: 'Eliminar reserva',
      cancelLabel: 'Cancelar',
    })

    if (!shouldDelete) {
      return
    }

    try {
      await withLoading({
        title: 'Eliminar reserva',
        description: 'Estamos procesando la eliminación de la reserva.',
        progress: {
          enabled: true,
        },
        action: async () => {
          await remove(reservation)
        },
      })

      await alert({
        variant: 'success',
        title: 'Reserva eliminada',
        hideProgressBar: true,
        hideProgressPercentage: true,
        iconVariant: 'success',
        progressPercentage: 100,
        closeLabel: 'Entendido',
      })
    } catch (error) {
      await showError({
        title: 'No pudimos eliminar la reserva',
        description: getReservationCrudErrorDescription(
          error,
          'No pudimos eliminar la reserva.',
        ),
        closeLabel: 'Entendido',
      })
    }
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
      production_company:
        values.productionCompany.trim().length > 0 ? values.productionCompany.trim() : null,
      starts_at: toIsoDateTime(values.startsAt),
      ends_at: toIsoDateTime(values.endsAt),
      status: values.status,
      notes: values.notes.trim().length > 0 ? values.notes.trim() : null,
    }

    try {
      const result = await withLoading({
        title: dialogMode === 'create' ? 'Crear reserva' : 'Guardar cambios',
        description:
          dialogMode === 'create'
            ? 'Estamos guardando la nueva reserva.'
            : 'Estamos guardando los cambios de la reserva.',
        progress: {
          enabled: true,
        },
        action: async () => {
          if (dialogMode === 'create') {
            return await create(payload)
          }

          if (!selectedReservation) {
            throw new Error('No encontramos la reserva que querés editar.')
          }

          return await update(selectedReservation.id, payload)
        },
      })

      setPendingFeedback(
        result.syncWarning
          ? {
              kind: 'warning',
              title: dialogMode === 'create'
                ? 'Reserva creada con advertencias'
                : 'Reserva actualizada con advertencias',
              description:
                'La reserva se guardó, pero quedaron sincronizaciones pendientes. Revisá Google Calendar o la solicitud vinculada antes de continuar.',
            }
          : {
              kind: 'success',
              title: dialogMode === 'create' ? 'Reserva creada' : 'Reserva actualizada',
            },
      )

      return true
    } catch (error) {
      await showError({
        title:
          dialogMode === 'create'
            ? 'No pudimos crear la reserva'
            : 'No pudimos guardar los cambios',
        description: getReservationCrudErrorDescription(
          error,
          dialogMode === 'create'
            ? 'No pudimos crear la reserva.'
            : 'No pudimos guardar los cambios de la reserva.',
        ),
        closeLabel: 'Entendido',
      })
      return false
    }
  }

  const reservationViewToggle = (
    <ReservationViewToggle
      value={activeView}
      onChange={setActiveView}
    />
  )

  const newReservationButton = (
    <Button className="gap-2" onClick={handleOpenCreateDialog}>
      <PlusIcon />
      Nueva reserva
    </Button>
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
        errorMessage={dialogValidationError}
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

      {!isLoading && !errorMessage ? (
        <>
          {activeView === 'calendar' ? (
            <ReservationsCalendar
              currentMonth={currentMonth}
              headerCenter={reservationViewToggle}
              headerEnd={newReservationButton}
              onMonthChange={(date) => setCurrentMonth(startOfMonth(date))}
              onSelectDay={handleOpenDayDetail}
              reservations={reservations}
            />
          ) : (
            <ReservationTable
              activeActionKey={activeActionKey}
              headerCenter={reservationViewToggle}
              headerEnd={newReservationButton}
              onDelete={handleDelete}
              onEdit={handleOpenEditDialog}
              onOpenReservation={handleOpenReservationDetail}
              reservations={reservations}
            />
          )}
        </>
      ) : null}
    </PageContainer>
  )
}

export default ReservationsPage
