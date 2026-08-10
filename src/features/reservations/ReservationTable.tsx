import { type ReactNode } from 'react'
import Card from '../../components/ui/Card'
import {
  formatReservationDateTime,
  getReservationStatusBadgeClassName,
  getReservationStatusLabel,
  type ReservationListItem,
} from './reservations.types'

type ReservationTableProps = {
  activeActionKey: string | null
  headerCenter?: ReactNode
  headerEnd?: ReactNode
  onDelete: (reservation: ReservationListItem) => Promise<void>
  onEdit: (reservation: ReservationListItem) => void
  onOpenReservation: (reservation: ReservationListItem) => void
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
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
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
  headerCenter,
  headerEnd,
  onDelete,
  onEdit,
  onOpenReservation,
  reservations,
}: ReservationTableProps) {
  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de reservas</h2>
            <p className="mt-1 text-sm text-slate-600">
              {reservations.length} {reservations.length === 1 ? 'reserva registrada' : 'reservas registradas'}
            </p>
          </div>

          {headerCenter ? (
            <div className="flex items-center justify-start lg:justify-center">
              {headerCenter}
            </div>
          ) : (
            <div />
          )}

          {headerEnd ? (
            <div className="flex items-center justify-start lg:justify-end">
              {headerEnd}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Locación</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Título</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Inicio</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Fin</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Estado</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Creado</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No se encontraron reservas.
                </td>
              </tr>
            ) : null}

            {reservations.map((reservation) => (
              <tr
                key={reservation.id}
                className="align-top transition hover:bg-slate-50"
                onClick={() => onOpenReservation(reservation)}
              >
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                  <div className="min-w-[240px]">{formatLocation(reservation)}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  <div className="min-w-[220px]">{reservation.title}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.startsAt)}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.endsAt)}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
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
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="min-w-[160px]">{formatReservationDateTime(reservation.createdAt)}</div>
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
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
