import type { ReservationListItem } from './reservations.types'

type ReservationCalendarDayProps = {
  day: Date
  dayReservations: ReservationListItem[]
  isCurrentMonth: boolean
  isToday: boolean
  onDayClick: (day: Date) => void
}

function ReservationCalendarDay({
  day,
  dayReservations,
  isCurrentMonth,
  isToday,
  onDayClick,
}: ReservationCalendarDayProps) {
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
        'flex min-h-32 flex-col rounded-lg border px-2.5 py-2.5 text-left transition',
        isCurrentMonth
          ? 'border-slate-200 bg-white/80 hover:bg-white'
          : 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-300',
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
                : 'bg-slate-400 text-slate-900',
          ].join(' ')}
        >
          {day.getDate()}
        </span>
        <span
          className={[
            'text-[11px] uppercase tracking-[0.18em]',
            isCurrentMonth ? 'text-slate-400' : 'text-slate-600',
          ].join(' ')}
        >
          {dayReservations.length > 0 ? `${dayReservations.length} res.` : ''}
        </span>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {dayReservations.length > 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p
              className={[
                'rounded-lg px-3 py-2 text-center text-sm font-semibold',
                isCurrentMonth
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-slate-300 text-slate-800',
              ].join(' ')}
            >
              {dayReservations.length}{' '}
              {dayReservations.length === 1 ? 'reserva' : 'reservas'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ReservationCalendarDay
