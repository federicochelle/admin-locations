import {
  getReservationStatusBadgeClassName,
  type ReservationListItem,
} from './reservations.types'

type ReservationCalendarEventProps = {
  reservation: ReservationListItem
  onClick: (reservation: ReservationListItem) => void
}

function formatLocation(reservation: ReservationListItem) {
  return reservation.locationCode?.trim()
    ? `${reservation.locationCode.replaceAll('-', ' ')} · ${reservation.locationTitle}`
    : reservation.locationTitle
}

function ReservationCalendarEvent({
  reservation,
  onClick,
}: ReservationCalendarEventProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick(reservation)
      }}
      className={[
        'w-full rounded-xl border px-2.5 py-2 text-left transition hover:brightness-[0.98]',
        getReservationStatusBadgeClassName(reservation.status),
      ].join(' ')}
    >
      <p className="truncate text-xs font-semibold">{reservation.title}</p>
      <p className="mt-1 truncate text-[11px] opacity-80">
        {formatLocation(reservation)}
      </p>
    </button>
  )
}

export default ReservationCalendarEvent
