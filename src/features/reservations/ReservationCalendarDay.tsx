import ReservationCalendarEvent from './ReservationCalendarEvent'
import type { ReservationListItem } from './reservations.types'

type ReservationCalendarDayProps = {
  day: Date
  dayReservations: ReservationListItem[]
  isCurrentMonth: boolean
  isToday: boolean
  onDayClick: (day: Date) => void
  onReservationClick: (reservation: ReservationListItem) => void
}

const MAX_VISIBLE_EVENTS = 3

function ReservationCalendarDay({
  day,
  dayReservations,
  isCurrentMonth,
  isToday,
  onDayClick,
  onReservationClick,
}: ReservationCalendarDayProps) {
  const visibleReservations = dayReservations.slice(0, MAX_VISIBLE_EVENTS)
  const hiddenReservationsCount = Math.max(
    dayReservations.length - visibleReservations.length,
    0,
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDayClick(day)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        event.preventDefault()
        onDayClick(day)
      }}
      className={[
        'flex min-h-32 flex-col rounded-2xl border p-3 text-left transition',
        isCurrentMonth
          ? 'border-slate-200 bg-white/80 hover:bg-white'
          : 'border-slate-200 bg-slate-50/80 text-slate-500 hover:bg-slate-100',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={[
            'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
            isToday
              ? 'bg-[#B8924A] text-white'
              : isCurrentMonth
                ? 'bg-slate-100 text-slate-900'
                : 'bg-slate-200 text-slate-500',
          ].join(' ')}
        >
          {day.getDate()}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {dayReservations.length > 0 ? `${dayReservations.length} res.` : ''}
        </span>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {visibleReservations.map((reservation) => (
          <ReservationCalendarEvent
            key={`${reservation.id}:${day.toISOString()}`}
            reservation={reservation}
            onClick={onReservationClick}
          />
        ))}

        {hiddenReservationsCount > 0 ? (
          <p className="px-1 text-xs font-medium text-slate-500">
            +{hiddenReservationsCount} m&aacute;s
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default ReservationCalendarDay
