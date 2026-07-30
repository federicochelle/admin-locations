import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLocationDetailPath,
  getReservationDetailPath,
} from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { getOwnerWhatsappDigits } from '../../lib/phone'
import {
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
  type ReservationStatus,
} from '../reservations/reservations.types'
import { createRequestProjectLocationReservation } from './admin-location-requests.service'
import type { AdminRequestLocation } from './admin-location-requests.types'

type RequestIncludedLocationsTableProps = {
  locations: AdminRequestLocation[]
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
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

type ToastState = {
  message: string
  tone: 'error' | 'success'
} | null

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

function isReservationStatus(value: string | null | undefined): value is ReservationStatus {
  return value === 'pending' || value === 'confirmed' || value === 'cancelled'
}

function getLocationRequestStatus(location: AdminRequestLocation): ReservationStatus | AdminRequestLocation['reservationStatus'] {
  if (isReservationStatus(location.reservationRecordStatus)) {
    return location.reservationRecordStatus
  }

  return location.reservationStatus ?? 'pending'
}

function getLocationStatusLabel(location: AdminRequestLocation) {
  const status = getLocationRequestStatus(location)

  return isReservationStatus(status)
    ? getReservationStatusLabel(status)
    : 'Pendiente'
}

function getLocationStatusBadgeClass(location: AdminRequestLocation) {
  const status = getLocationRequestStatus(location)

  return isReservationStatus(status)
    ? getReservationStatusBadgeClassName(status)
    : getReservationStatusBadgeClassName('pending')
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldLabelClassName() {
  return 'mb-2 block text-sm font-medium text-slate-700'
}

function getReserveInitialValues(): ReserveFormValues {
  return {
    startsAt: '',
    endsAt: '',
  }
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
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const ownerName = input.ownerName?.trim() || 'dueno'
  const companyName = input.companyName?.trim() || 'A confirmar'
  const formattedStartDate = formatDisplayDate(input.tentativeStartDate)
  const formattedEndDate = formatDisplayDate(input.tentativeEndDate)

  return [
    `Hola ${ownerName}.`,
    '',
    `Tu locacion "${input.locationTitle}" fue preseleccionada para una produccion audiovisual.`,
    '',
    'Fecha tentativa:',
    `${formattedStartDate} al ${formattedEndDate}`,
    '',
    'Productora:',
    companyName,
    '',
    'Nos estaremos comunicando contigo para confirmar disponibilidad.',
    '',
    'Muchas gracias.',
  ].join('\n')
}

function getWhatsappUrl(input: {
  ownerPhone: string | null
  ownerName: string | null
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const normalizedPhone = getOwnerWhatsappDigits(input.ownerPhone)

  if (!normalizedPhone) {
    return null
  }

  const message = buildSelectionMessage({
    ownerName: input.ownerName,
    locationTitle: input.locationTitle,
    tentativeStartDate: input.tentativeStartDate,
    tentativeEndDate: input.tentativeEndDate,
    companyName: input.companyName,
  })

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

function getMailtoUrl(input: {
  ownerEmail: string | null
  ownerName: string | null
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const ownerEmail = input.ownerEmail?.trim()

  if (!ownerEmail) {
    return null
  }

  const subject = `Preseleccion de locacion - ${input.locationTitle}`
  const body = buildSelectionMessage({
    ownerName: input.ownerName,
    locationTitle: input.locationTitle,
    tentativeStartDate: input.tentativeStartDate,
    tentativeEndDate: input.tentativeEndDate,
    companyName: input.companyName,
  })

  return `mailto:${ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-24 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
  )
}

function WhatsappIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M20 11.5a8 8 0 0 1-11.8 7l-4.2 1 1.1-4A8 8 0 1 1 20 11.5Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.3 8.7c.2-.4.4-.4.6-.4h.5c.1 0 .3 0 .4.4l.5 1.5c.1.2 0 .4-.1.6l-.3.4c-.1.1-.2.3 0 .6.3.6 1 1.5 2.2 2 .4.2.6.1.8 0l.4-.3c.2-.1.3-.2.6-.1l1.4.7c.2.1.3.2.3.4v.5c0 .2-.1.5-.4.6-.5.2-1.1.3-1.7.1-1-.2-2-.8-3-1.7-.8-.7-1.5-1.7-1.9-2.8-.3-.7-.2-1.4-.1-1.8Z"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M4 6h16v12H4z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m4 8 8 6 8-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        strokeWidth="1.8"
      />
    </svg>
  )
}

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

function ActionLink({
  actionLabel,
  href,
  children,
}: {
  actionLabel: string
  href: string | null
  children: React.ReactNode
}) {
  const className =
    'group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition'

  if (!href) {
    return (
      <span
        aria-label={`${actionLabel} no disponible`}
        className={`${className} cursor-not-allowed border-slate-200 text-slate-300 opacity-60`}
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
      aria-label={actionLabel}
      className={`${className} border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
        {actionLabel}
      </span>
    </a>
  )
}

function ReserveLocationModal({
  isSubmitting,
  location,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean
  location: AdminRequestLocation
  onClose: () => void
  onSubmit: (input: {
    requestProjectLocationId: string
    startsAt: string
    endsAt: string
  }) => Promise<void>
}) {
  const [values, setValues] = useState<ReserveFormValues>(getReserveInitialValues)
  const formattedLocationCode = getFormattedLocationCode(location.locationCode)

  useEffect(() => {
    setValues(getReserveInitialValues())
  }, [location.requestProjectLocationId])

  function handleChange(field: keyof ReserveFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await onSubmit({
      requestProjectLocationId: location.requestProjectLocationId,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
    })
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

function Toast({
  toast,
}: {
  toast: ToastState
}) {
  if (!toast) {
    return null
  }

  return (
    <div className="fixed right-4 top-4 z-[60] max-w-sm">
      <div
        className={[
          'rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
          toast.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700',
        ].join(' ')}
      >
        {toast.message}
      </div>
    </div>
  )
}

function RequestIncludedLocationsTable({
  locations,
  tentativeStartDate,
  tentativeEndDate,
  companyName,
  onReservationCreated = async () => {},
  title = 'Locaciones incluidas',
  description = `${locations.length} locaciones asociadas a esta solicitud.`,
  emptyTitle = 'No hay locaciones asociadas',
  emptyDescription = 'Esta solicitud no tiene locaciones vinculadas para mostrar en la ficha.',
}: RequestIncludedLocationsTableProps) {
  const navigate = useNavigate()
  const [selectedLocationToReserve, setSelectedLocationToReserve] =
    useState<AdminRequestLocation | null>(null)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  async function handleCreateReservation(input: {
    requestProjectLocationId: string
    startsAt: string
    endsAt: string
  }) {
    try {
      setIsCreatingReservation(true)

      await createRequestProjectLocationReservation({
        requestProjectLocationId: input.requestProjectLocationId,
        startsAt: formatToIsoDateTime(input.startsAt),
        endsAt: formatToIsoDateTime(input.endsAt),
      })

      await onReservationCreated()
      setSelectedLocationToReserve(null)
      setToast({
        message: 'Reserva creada correctamente.',
        tone: 'success',
      })
    } catch (error) {
      setToast({
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'No pudimos crear la reserva.',
        tone: 'error',
      })
    } finally {
      setIsCreatingReservation(false)
    }
  }

  return (
    <>
      <Toast toast={toast} />

      {selectedLocationToReserve ? (
        <ReserveLocationModal
          isSubmitting={isCreatingReservation}
          location={selectedLocationToReserve}
          onClose={() => {
            if (isCreatingReservation) {
              return
            }

            setSelectedLocationToReserve(null)
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

        {locations.length === 0 ? (
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
                    Acciones
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-transparent">
                {locations.map((location) => {
                  const formattedLocationCode = getFormattedLocationCode(
                    location.locationCode,
                  )
                  const hasLinkedReservation = Boolean(location.reservationId)
                  const whatsappUrl = getWhatsappUrl({
                    ownerPhone: location.ownerPhone,
                    ownerName: location.ownerName,
                    locationTitle: location.title,
                    tentativeStartDate,
                    tentativeEndDate,
                    companyName,
                  })
                  const mailtoUrl = getMailtoUrl({
                    ownerEmail: location.ownerEmail,
                    ownerName: location.ownerName,
                    locationTitle: location.title,
                    tentativeStartDate,
                    tentativeEndDate,
                    companyName,
                  })

                  return (
                    <tr
                      key={location.requestProjectLocationId}
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
                          {formatCellValue(location.ownerPhone)}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="flex flex-nowrap items-center gap-2">
                          <ActionLink actionLabel="WhatsApp" href={whatsappUrl}>
                            <WhatsappIcon />
                          </ActionLink>
                          <ActionLink actionLabel="Email" href={mailtoUrl}>
                            <EmailIcon />
                          </ActionLink>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                        <div className="flex min-w-[140px] items-center gap-2">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                              getLocationStatusBadgeClass(location),
                            ].join(' ')}
                          >
                            {getLocationStatusLabel(location)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasLinkedReservation) {
                                setSelectedLocationToReserve(location)
                                return
                              }

                              if (!location.reservationId) {
                                return
                              }

                              navigate(getReservationDetailPath(location.reservationId))
                            }}
                            aria-label={hasLinkedReservation ? 'Ver reserva' : 'Reservar'}
                            title={hasLinkedReservation ? 'Ver reserva' : 'Reservar'}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                          >
                            {hasLinkedReservation ? <EyeIcon /> : <PlusIcon />}
                          </button>
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
