import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ReservationCalendarDay from './ReservationCalendarDay'
import {
  CALENDAR_WEEKDAY_LABELS,
  addMonths,
  getCalendarDays,
  getMonthLabel,
  getReservationsForDay,
  isSameMonth,
  isToday,
} from './reservation-calendar.helpers'
import type { ReservationListItem } from './reservations.types'

type ReservationsCalendarProps = {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onOpenReservation: (reservation: ReservationListItem) => void
  onSelectDay: (day: Date) => void
  reservations: ReservationListItem[]
}

function ReservationsCalendar({
  currentMonth,
  onMonthChange,
  onOpenReservation,
  onSelectDay,
  reservations,
}: ReservationsCalendarProps) {
  const calendarDays = getCalendarDays(currentMonth)

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {getMonthLabel(currentMonth)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => onMonthChange(addMonths(currentMonth, -1))}
            >
              Mes anterior
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMonthChange(new Date())}
            >
              Hoy
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            >
              Mes siguiente
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] p-4">
          <div className="grid grid-cols-7 gap-3">
            {CALENDAR_WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
              >
                {label}
              </div>
            ))}

            {calendarDays.map((day) => (
              <ReservationCalendarDay
                key={day.toISOString()}
                day={day}
                dayReservations={getReservationsForDay(reservations, day)}
                isCurrentMonth={isSameMonth(day, currentMonth)}
                isToday={isToday(day)}
                onDayClick={onSelectDay}
                onReservationClick={onOpenReservation}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ReservationsCalendar
