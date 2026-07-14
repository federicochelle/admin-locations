import { useMemo, useState, type ReactNode } from 'react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import {
  formatReservationDateTime,
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
  type ReservationListItem,
} from './reservations.types'

type ReservationTableProps = {
  activeActionKey: string | null
  headerActions?: ReactNode
  onDelete: (reservation: ReservationListItem) => Promise<void>
  onEdit: (reservation: ReservationListItem) => void
  reservations: ReservationListItem[]
}

function ActionIconButton({
  actionLabel,
  buttonClassName = '',
  children,
  disabled = false,
  onClick,
}: {
  actionLabel: string
  buttonClassName?: string
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={actionLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        'group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-60',
        buttonClassName,
      ].join(' ')}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
        {actionLabel}
      </span>
    </button>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 20h9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4h8v2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatLocation(reservation: ReservationListItem) {
  return reservation.locationCode?.trim()
    ? `${reservation.locationCode.replaceAll('-', ' ')} · ${reservation.locationTitle}`
    : reservation.locationTitle
}

function ReservationTable({
  activeActionKey,
  headerActions,
  onDelete,
  onEdit,
  reservations,
}: ReservationTableProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredReservations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase()

    if (normalizedSearch.length === 0) {
      return reservations
    }

    return reservations.filter((reservation) => {
      const fields = [
        reservation.title,
        reservation.locationTitle,
        reservation.locationCode ?? '',
        getReservationStatusLabel(reservation.status),
      ]

      return fields.some((field) =>
        field.toLocaleLowerCase().includes(normalizedSearch),
      )
    })
  }, [reservations, searchTerm])

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de reservas</h2>
            <p className="mt-1 text-sm text-slate-600">
              {filteredReservations.length} de {reservations.length} reservas visibles
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Buscar por locación, título o estado"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            {headerActions}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Locación</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Título</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Inicio</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Fin</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Creado</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {filteredReservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-sm text-slate-500">
                  No se encontraron reservas.
                </td>
              </tr>
            ) : null}

            {filteredReservations.map((reservation) => (
              <tr key={reservation.id} className="align-top">
                <td className="px-6 py-4 text-sm font-medium text-slate-950">
                  <div className="min-w-[240px]">{formatLocation(reservation)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="min-w-[220px]">{reservation.title}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.startsAt)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.endsAt)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[140px]">
                    <span
                      className={[
                        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                        getReservationStatusBadgeClassName(reservation.status),
                      ].join(' ')}
                    >
                      {getReservationStatusLabel(reservation.status)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.createdAt)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="flex flex-wrap gap-2">
                    <ActionIconButton
                      actionLabel="Editar"
                      buttonClassName="border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
                      disabled={activeActionKey !== null}
                      onClick={() => onEdit(reservation)}
                    >
                      <EditIcon />
                    </ActionIconButton>

                    <ActionIconButton
                      actionLabel={
                        activeActionKey === `delete:${reservation.id}`
                          ? 'Eliminando...'
                          : 'Eliminar'
                      }
                      buttonClassName="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                      disabled={activeActionKey !== null}
                      onClick={() => void onDelete(reservation)}
                    >
                      <DeleteIcon />
                    </ActionIconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default ReservationTable
