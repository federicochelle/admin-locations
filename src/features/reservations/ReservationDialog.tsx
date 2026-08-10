import { useState } from 'react'
import ReservationForm from './ReservationForm'
import {
  getReservationInitialValues,
  toReservationDateTimeLocalValue,
  type ReservationFormValues,
  type ReservationListItem,
  type ReservationLocationOption,
  type ReservationStatus,
} from './reservations.types'

type ReservationDialogProps = {
  errorMessage: string | null
  initialValues?: Partial<ReservationFormValues> | null
  isOpen: boolean
  isSubmitting: boolean
  locationOptions: ReservationLocationOption[]
  mode: 'create' | 'edit'
  reservation: ReservationListItem | null
  onClose: () => void
  onSubmit: (values: ReservationFormValues) => Promise<boolean>
}

function getInitialValues(
  reservation: ReservationListItem | null,
  initialValues: Partial<ReservationFormValues> | null,
): ReservationFormValues {
  if (!reservation) {
    return {
      ...getReservationInitialValues(),
      ...initialValues,
    }
  }

  return {
    locationId: reservation.locationId,
    locationSearch:
      initialValues?.locationSearch ??
      reservation.locationCode?.trim()
        ? `${reservation.locationCode?.replaceAll('-', ' ')} · ${reservation.locationTitle}`
        : reservation.locationTitle,
    title: reservation.title,
    productionCompany: reservation.productionCompany ?? '',
    startsAt: toReservationDateTimeLocalValue(reservation.startsAt),
    endsAt: toReservationDateTimeLocalValue(reservation.endsAt),
    status: reservation.status,
    notes: reservation.notes ?? '',
  }
}

function ReservationDialog({
  errorMessage,
  initialValues = null,
  isOpen,
  isSubmitting,
  locationOptions,
  mode,
  reservation,
  onClose,
  onSubmit,
}: ReservationDialogProps) {
  const [values, setValues] = useState<ReservationFormValues>(
    () => getInitialValues(reservation, initialValues),
  )

  if (!isOpen) {
    return null
  }

  function handleChange(field: keyof ReservationFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]:
        field === 'status'
          ? (value as ReservationStatus)
          : value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const wasSuccessful = await onSubmit(values)

    if (wasSuccessful) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-dialog-title"
        className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="space-y-6">
          <div>
            <h2
              id="reservation-dialog-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {mode === 'create' ? 'Nueva reserva' : 'Editar reserva'}
            </h2>
          </div>

          <ReservationForm
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            locationOptions={locationOptions}
            mode={mode}
            onChange={handleChange}
            onClose={onClose}
            onSubmit={handleSubmit}
            values={values}
          />
        </div>
      </div>
    </div>
  )
}

export default ReservationDialog
