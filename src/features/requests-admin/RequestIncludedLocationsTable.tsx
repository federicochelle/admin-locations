import { useEffect, useState } from 'react'
import {
  getLocationDetailPath,
} from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { useAdminFeedback } from '../../components/ui/admin-feedback/useAdminFeedback'
import { getOwnerWhatsappDigits } from '../../lib/phone'
import {
  deleteReservation,
  saveConfirmedReservation,
} from '../reservations/reservations.service'
import {
  updateRequestProjectLocationStatus,
} from './admin-location-requests.service'
import type {
  AdminRequestLocation,
  RequestProjectLocationStatus,
} from './admin-location-requests.types'

type RequestIncludedLocationsTableProps = {
  locations: AdminRequestLocation[]
  product: string
  productionCompany: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  onReservationCreated?: () => Promise<void>
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
}

type ReserveFormValues = {
  endsAt: string
  startsAt: string
}

type PendingReservationSelection = {
  location: AdminRequestLocation
}

const REQUEST_PROJECT_LOCATION_STATUS_OPTIONS: Array<{
  label: string
  value: RequestProjectLocationStatus
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'cancelled', label: 'Cancelada' },
]

function formatCellValue(value: string | null) {
  const hasValue = value && value.trim().length > 0

  return (
    <span className={hasValue ? 'text-slate-900' : 'text-slate-500'}>
      {hasValue ? value : '-'}
    </span>
  )
}

function getFormattedLocationCode(locationCode: string | null) {
  const normalizedCode = locationCode?.trim()

  return normalizedCode ? normalizedCode.replaceAll('-', ' ') : null
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function getRequestProjectLocationStatusSelectClassName(
  status: RequestProjectLocationStatus,
) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700 focus:border-amber-300 focus:ring-amber-100'
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300 focus:ring-emerald-100'
    case 'cancelled':
      return 'border-slate-300 bg-slate-100 text-slate-600 focus:border-slate-400 focus:ring-slate-200'
  }
}

function fieldLabelClassName() {
  return 'mb-2 block text-sm font-medium text-slate-700'
}

function formatDateTimeLocalValue(value: string | null) {
  const normalizedValue = value?.trim() || ''

  if (!normalizedValue) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedValue)) {
    return normalizedValue
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return `${normalizedValue}T00:00`
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  const hours = String(parsedDate.getHours()).padStart(2, '0')
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatToIsoDateTime(value: string) {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Revisá la fecha y hora seleccionadas para continuar.')
  }

  return parsedDate.toISOString()
}

function formatDisplayDate(value: string | null) {
  if (!value) {
    return 'A confirmar'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate)
}

function buildSelectionMessage(input: {
  ownerName: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
}) {
  const ownerName = input.ownerName?.trim() || 'dueno'
  const formattedStartDate = formatDisplayDate(input.tentativeStartDate)
  const formattedEndDate = formatDisplayDate(input.tentativeEndDate)

  return [
    `Hola ${ownerName}.`,
    '',
    'Queremos informarte que una de tus locaciones fue preseleccionada para una posible producción audiovisual.',
    '',
    'Fecha tentativa:',
    `${formattedStartDate} al ${formattedEndDate}`,
    '',
    'Nos estaremos comunicando contigo para confirmar disponibilidad y brindarte más detalles.',
    '',
    'Muchas gracias.',
  ].join('\n')
}

function getWhatsappUrl(input: {
  ownerPhone: string | null
  ownerName: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
}) {
  const normalizedPhone = getOwnerWhatsappDigits(input.ownerPhone)

  if (!normalizedPhone) {
    return null
  }

  const message = buildSelectionMessage({
    ownerName: input.ownerName,
    tentativeStartDate: input.tentativeStartDate,
    tentativeEndDate: input.tentativeEndDate,
  })

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-24 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
  )
}

function InlineSpinner() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 text-slate-500"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 animate-spin"
      >
        <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      </svg>
    </span>
  )
}

function ReserveLocationModal({
  errorMessage,
  initialValues,
  isSubmitting,
  location,
  onClose,
  onSubmit,
}: {
  errorMessage: string | null
  initialValues: ReserveFormValues
  isSubmitting: boolean
  location: AdminRequestLocation
  onClose: () => void
  onSubmit: (input: ReserveFormValues) => Promise<void>
}) {
  const [values, setValues] = useState<ReserveFormValues>(initialValues)
  const formattedLocationCode = getFormattedLocationCode(location.locationCode)

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues, location.rowKey])

  function handleChange(field: keyof ReserveFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await onSubmit(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reserve-location-dialog-title"
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h2
              id="reserve-location-dialog-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {`Confirmar reserva: ${formattedLocationCode ?? 'Sin código'}`}
            </h2>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClassName()} htmlFor="reserve-starts-at">
                Fecha y hora de inicio
              </label>
              <input
                id="reserve-starts-at"
                type="datetime-local"
                value={values.startsAt}
                onChange={(event) => handleChange('startsAt', event.target.value)}
                className={inputClassName()}
                required
              />
            </div>

            <div>
              <label className={fieldLabelClassName()} htmlFor="reserve-ends-at">
                Fecha y hora de fin
              </label>
              <input
                id="reserve-ends-at"
                type="datetime-local"
                value={values.endsAt}
                onChange={(event) => handleChange('endsAt', event.target.value)}
                className={inputClassName()}
                required
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RequestIncludedLocationsTable({
  locations,
  product,
  productionCompany,
  tentativeStartDate,
  tentativeEndDate,
  onReservationCreated = async () => {},
  title = 'Locaciones incluidas',
  description = `${locations.length} locaciones asociadas a esta solicitud.`,
  emptyTitle = 'No hay locaciones asociadas',
  emptyDescription = 'Esta solicitud no tiene locaciones vinculadas para mostrar en la ficha.',
}: RequestIncludedLocationsTableProps) {
  const [displayLocations, setDisplayLocations] = useState(locations)
  const [pendingReservationSelection, setPendingReservationSelection] =
    useState<PendingReservationSelection | null>(null)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [reservationFormError, setReservationFormError] = useState<string | null>(null)
  const [activeStatusUpdateId, setActiveStatusUpdateId] = useState<string | null>(null)
  const { toast } = useAdminFeedback()

  useEffect(() => {
    setDisplayLocations(locations)
  }, [locations])

  function getReserveModalInitialValues(location: AdminRequestLocation): ReserveFormValues {
    if (location.reservationStartsAt || location.reservationEndsAt) {
      return {
        startsAt: formatDateTimeLocalValue(location.reservationStartsAt),
        endsAt: formatDateTimeLocalValue(location.reservationEndsAt),
      }
    }

    return {
      startsAt: formatDateTimeLocalValue(tentativeStartDate),
      endsAt: formatDateTimeLocalValue(tentativeEndDate),
    }
  }

  async function handleCreateReservation(input: ReserveFormValues) {
    const currentSelection = pendingReservationSelection

    if (!currentSelection) {
      return
    }

    try {
      setIsCreatingReservation(true)
      setReservationFormError(null)

      const result = await saveConfirmedReservation({
        reservationId: currentSelection.location.reservationId,
        locationId: currentSelection.location.id,
        product,
        productionCompany,
        startsAt: formatToIsoDateTime(input.startsAt),
        endsAt: formatToIsoDateTime(input.endsAt),
        requestProjectLocationId: currentSelection.location.requestProjectLocationId,
      })

      await onReservationCreated()
      setPendingReservationSelection(null)
      toast({
        variant: result.syncWarning ? 'warning' : 'success',
        title: result.syncWarning ?? 'Reserva confirmada correctamente.',
      })
    } catch (error) {
      setReservationFormError(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'No pudimos crear la reserva.',
      )
    } finally {
      setIsCreatingReservation(false)
    }
  }

  async function handleStatusChange(
    location: AdminRequestLocation,
    nextStatus: RequestProjectLocationStatus,
  ) {
    const previousStatus = location.requestProjectLocationStatus

    if (previousStatus === nextStatus) {
      return
    }

    if (nextStatus === 'confirmed') {
      setReservationFormError(null)
      setPendingReservationSelection({
        location,
      })
      return
    }

    if (nextStatus === 'pending' && location.reservationId) {
      setActiveStatusUpdateId(location.rowKey)
      setDisplayLocations((currentLocations) =>
        currentLocations.map((currentLocation) =>
          currentLocation.rowKey === location.rowKey
            ? {
                ...currentLocation,
                requestProjectLocationStatus: 'pending',
                reservationRecordStatus: 'cancelled',
              }
            : currentLocation,
        ),
      )

      try {
        await deleteReservation(location.reservationId)
        await updateRequestProjectLocationStatus({
          requestProjectVersionId: location.requestProjectVersionId,
          locationId: location.id,
          status: 'pending',
        })
        await onReservationCreated()
        toast({
          variant: 'success',
          title: 'Estado actualizado correctamente.',
        })
      } catch (error) {
        await onReservationCreated()
        setDisplayLocations((currentLocations) =>
          currentLocations.map((currentLocation) =>
            currentLocation.rowKey === location.rowKey
              ? {
                  ...currentLocation,
                  requestProjectLocationStatus: previousStatus,
                  reservationRecordStatus: location.reservationRecordStatus,
                }
              : currentLocation,
          ),
        )
        toast({
          variant: 'error',
          title:
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : 'No pudimos actualizar la reserva asociada a esta locación.',
        })
      } finally {
        setActiveStatusUpdateId(null)
      }
      return
    }

    if (nextStatus === 'cancelled') {
      if (location.reservationId) {
        setActiveStatusUpdateId(location.rowKey)
        setDisplayLocations((currentLocations) =>
          currentLocations.map((currentLocation) =>
            currentLocation.rowKey === location.rowKey
              ? {
                  ...currentLocation,
                  requestProjectLocationStatus: 'cancelled',
                  reservationRecordStatus: 'cancelled',
                }
              : currentLocation,
          ),
        )

        try {
          await deleteReservation(location.reservationId)
          await updateRequestProjectLocationStatus({
            requestProjectVersionId: location.requestProjectVersionId,
            locationId: location.id,
            status: 'cancelled',
          })
          await onReservationCreated()
          toast({
            variant: 'success',
            title: 'Reserva cancelada correctamente.',
          })
        } catch (error) {
          setDisplayLocations((currentLocations) =>
            currentLocations.map((currentLocation) =>
              currentLocation.rowKey === location.rowKey
                ? {
                    ...currentLocation,
                    requestProjectLocationStatus: previousStatus,
                    reservationRecordStatus: location.reservationRecordStatus,
                  }
                : currentLocation,
            ),
          )
          toast({
            variant: 'error',
            title:
              error instanceof Error && error.message.trim().length > 0
                ? error.message
                : 'No pudimos cancelar la reserva.',
          })
        } finally {
          setActiveStatusUpdateId(null)
        }
        return
      }
    }

    setActiveStatusUpdateId(location.rowKey)
    setDisplayLocations((currentLocations) =>
      currentLocations.map((currentLocation) =>
        currentLocation.rowKey === location.rowKey
          ? {
              ...currentLocation,
              requestProjectLocationStatus: nextStatus,
            }
          : currentLocation,
      ),
    )

    try {
      const updatedLocation = await updateRequestProjectLocationStatus(
        {
          requestProjectVersionId: location.requestProjectVersionId,
          locationId: location.id,
          status: nextStatus,
        },
      )

      setDisplayLocations((currentLocations) =>
        currentLocations.map((currentLocation) =>
          currentLocation.requestProjectVersionId === updatedLocation.requestProjectVersionId &&
          currentLocation.id === updatedLocation.locationId
            ? {
                ...currentLocation,
                requestProjectLocationStatus: updatedLocation.status,
              }
            : currentLocation,
        ),
      )
      toast({
        variant: 'success',
        title: 'Estado actualizado correctamente.',
      })
    } catch (error) {
      setDisplayLocations((currentLocations) =>
        currentLocations.map((currentLocation) =>
          currentLocation.rowKey === location.rowKey
            ? {
                ...currentLocation,
                requestProjectLocationStatus: previousStatus,
              }
            : currentLocation,
        ),
      )
      toast({
        variant: 'error',
        title:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'No pudimos actualizar el estado de la locación.',
      })
    } finally {
      setActiveStatusUpdateId(null)
    }
  }

  return (
    <>
      {pendingReservationSelection ? (
        <ReserveLocationModal
          errorMessage={reservationFormError}
          initialValues={getReserveModalInitialValues(pendingReservationSelection.location)}
          isSubmitting={isCreatingReservation}
          location={pendingReservationSelection.location}
          onClose={() => {
            if (isCreatingReservation) {
              return
            }

            setPendingReservationSelection(null)
            setReservationFormError(null)
          }}
          onSubmit={handleCreateReservation}
        />
      ) : null}

      <Card className="-mx-4 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
        <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {displayLocations.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#f3f2ee]">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Imagen
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Locacion
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Dueno
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Telefono
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-transparent">
                {displayLocations.map((location) => {
                  const formattedLocationCode = getFormattedLocationCode(
                    location.locationCode,
                  )
                  const isUpdatingStatus =
                    activeStatusUpdateId === location.rowKey
                  const whatsappUrl = getWhatsappUrl({
                    ownerPhone: location.ownerPhone,
                    ownerName: location.ownerName,
                    tentativeStartDate,
                    tentativeEndDate,
                  })
                  return (
                    <tr
                      key={location.rowKey}
                      className="align-top transition hover:bg-[rgba(184,146,74,0.10)]"
                    >
                      <td className="px-3 py-4 sm:px-6">
                        {location.coverImageUrl ? (
                          <div className="h-14 w-24 overflow-hidden border border-slate-200 bg-slate-100">
                            <img
                              src={location.coverImageUrl}
                              alt={`Portada de ${location.title}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <CoverPlaceholder />
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="min-w-[180px] max-w-[220px]">
                          {formattedLocationCode ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8924A]">
                              {formattedLocationCode}
                            </p>
                          ) : null}
                          <a
                            href={getLocationDetailPath(location.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-sm font-medium leading-5 text-slate-950 underline-offset-4 transition hover:underline"
                          >
                            {location.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        {formatCellValue(location.ownerName)}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="min-w-[140px] whitespace-nowrap">
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-slate-900 underline-offset-4 transition hover:text-slate-950 hover:underline"
                            >
                              {location.ownerPhone?.trim() || '-'}
                            </a>
                          ) : (
                            formatCellValue(location.ownerPhone)
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="relative min-w-[140px]">
                          {isUpdatingStatus ? <InlineSpinner /> : null}
                          <select
                            value={location.requestProjectLocationStatus}
                            onChange={(event) =>
                              void handleStatusChange(
                                location,
                                event.target.value as RequestProjectLocationStatus,
                              )
                            }
                            disabled={isUpdatingStatus}
                            className={[
                              'min-w-[140px] rounded-xl pr-1 py-2 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
                              'pl-3',
                              getRequestProjectLocationStatusSelectClassName(
                                location.requestProjectLocationStatus,
                              ),
                            ].join(' ')}
                          >
                            {REQUEST_PROJECT_LOCATION_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

export default RequestIncludedLocationsTable
