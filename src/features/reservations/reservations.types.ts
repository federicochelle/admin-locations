export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

export type ReservationListItem = {
  id: string
  locationId: string
  locationTitle: string
  locationCode: string | null
  formattedAddress: string | null
  coverImageUrl: string | null
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  title: string
  startsAt: string
  endsAt: string
  status: ReservationStatus
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ReservationCreatePayload = {
  location_id: string
  title: string
  starts_at: string
  ends_at: string
  status: ReservationStatus
  notes: string | null
}

export type ReservationUpdatePayload = ReservationCreatePayload

export type ReservationFormValues = {
  locationId: string
  title: string
  startsAt: string
  endsAt: string
  status: ReservationStatus
  notes: string
}

export type ReservationLocationOption = {
  id: string
  title: string
  locationCode: string | null
}

export const RESERVATION_STATUS_OPTIONS: Array<{
  label: string
  value: ReservationStatus
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'cancelled', label: 'Cancelada' },
]

export function getReservationStatusLabel(status: ReservationStatus) {
  return (
    RESERVATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  )
}

export function getReservationStatusBadgeClassName(status: ReservationStatus) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'cancelled':
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

export function formatReservationDateTime(value: string) {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function toReservationDateTimeLocalValue(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function getReservationInitialValues(): ReservationFormValues {
  return {
    locationId: '',
    title: '',
    startsAt: '',
    endsAt: '',
    status: 'pending',
    notes: '',
  }
}
