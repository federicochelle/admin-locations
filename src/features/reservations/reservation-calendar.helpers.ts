import type {
  ReservationFormValues,
  ReservationListItem,
} from './reservations.types'

export const CALENDAR_WEEKDAY_LABELS = [
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
  'Dom',
] as const

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function addDays(date: Date, amount: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function startOfWeek(date: Date) {
  const normalizedDate = startOfDay(date)
  const weekDay = normalizedDate.getDay()
  const diff = weekDay === 0 ? -6 : 1 - weekDay
  return addDays(normalizedDate, diff)
}

export function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6)
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  )
}

export function getMonthLabel(date: Date) {
  const formatter = new Intl.DateTimeFormat('es-UY', {
    month: 'long',
    year: 'numeric',
  })

  const label = formatter.format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function getCalendarDays(referenceDate: Date) {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)
  const rangeStart = startOfWeek(monthStart)
  const rangeEnd = endOfWeek(monthEnd)
  const days: Date[] = []

  for (
    let currentDate = rangeStart;
    currentDate <= rangeEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    days.push(currentDate)
  }

  return days
}

export function reservationOccursOnDay(
  reservation: ReservationListItem,
  day: Date,
) {
  const reservationStart = new Date(reservation.startsAt)
  const reservationEnd = new Date(reservation.endsAt)
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)

  return reservationStart <= dayEnd && reservationEnd > dayStart
}

export function getReservationsForDay(
  reservations: ReservationListItem[],
  day: Date,
) {
  return reservations.filter((reservation) => reservationOccursOnDay(reservation, day))
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function buildReservationPrefillValues(day: Date): Partial<ReservationFormValues> {
  const startsAt = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    9,
    0,
    0,
    0,
  )
  const endsAt = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    10,
    0,
    0,
    0,
  )

  return {
    startsAt: toDateTimeLocalValue(startsAt),
    endsAt: toDateTimeLocalValue(endsAt),
  }
}
