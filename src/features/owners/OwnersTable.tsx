import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import { getOwnerEditPath, routePaths } from '../../app/router/route-paths'
import type { OwnerListItem } from './owners.types'

type OwnersTableProps = {
  owners: OwnerListItem[]
  activeActionKey: string | null
  onDelete: (owner: OwnerListItem) => Promise<void>
}

type OwnerSortKey = 'full_name' | 'locations_count'
type OwnerSortDirection = 'asc' | 'desc'

function formatCellValue(value: string | null) {
  const hasValue = value && value.trim().length > 0

  return (
    <span className={hasValue ? 'text-slate-900' : 'text-slate-500'}>
      {hasValue ? value : '-'}
    </span>
  )
}

function formatLocationsCount(count: number) {
  return `${count} ${count === 1 ? 'locación' : 'locaciones'}`
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

function SortIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className="h-3.5 w-3.5 transition"
      aria-hidden="true"
    >
      <path
        d="M5 13V3.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isActive ? 'opacity-100' : 'opacity-70'}
      />
      <path
        d="m2.75 5.75 2.25-2.25 2.25 2.25"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isActive ? 'opacity-100' : 'opacity-70'}
      />
      <path
        d="M11 3v9.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isActive ? 'opacity-100' : 'opacity-70'}
      />
      <path
        d="m8.75 10.25 2.25 2.25 2.25-2.25"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isActive ? 'opacity-100' : 'opacity-70'}
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

function OwnersTable({
  owners,
  activeActionKey,
  onDelete,
}: OwnersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<OwnerSortKey>('full_name')
  const [sortDirection, setSortDirection] = useState<OwnerSortDirection>('asc')

  const filteredOwners = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase()

    const nextOwners =
      normalizedSearch.length === 0
        ? owners
        : owners.filter((owner) => {
            const fields = [
              owner.full_name,
              owner.company_name ?? '',
              owner.email ?? '',
            ]

            return fields.some((field) =>
              field.toLocaleLowerCase().includes(normalizedSearch),
            )
          })

    return [...nextOwners].sort((left, right) => {
      if (sortKey === 'locations_count') {
        const difference = left.locations_count - right.locations_count
        return sortDirection === 'asc' ? difference : -difference
      }

      const comparison = left.full_name.localeCompare(right.full_name, 'es', {
        sensitivity: 'base',
      })

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [owners, searchTerm, sortDirection, sortKey])

  function handleSort(nextSortKey: OwnerSortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      )
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('asc')
  }

  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de dueños</h2>
            <p className="mt-1 text-sm text-slate-600">
              {owners.length} {owners.length === 1 ? 'dueño registrado' : 'dueños registrados'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Buscar dueño, empresa o email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <Link
              to={routePaths.ownerNew}
              className={[buttonBaseClassName, buttonVariantClasses.primary, 'gap-2 py-2.5'].join(' ')}
            >
              <PlusIcon />
              Nuevo dueño
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                <button
                  type="button"
                  onClick={() => handleSort('full_name')}
                  className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                >
                  <span>NOMBRE</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'full_name'
                        ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                        : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                    ].join(' ')}
                  >
                    <SortIcon
                      isActive={sortKey === 'full_name'}
                    />
                  </span>
                </button>
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Email</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Teléfono</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                <button
                  type="button"
                  onClick={() => handleSort('locations_count')}
                  className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                >
                  <span>LOCACIONES</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'locations_count'
                        ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                        : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                    ].join(' ')}
                  >
                    <SortIcon
                      isActive={sortKey === 'locations_count'}
                    />
                  </span>
                </button>
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {filteredOwners.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No se encontraron dueños.
                </td>
              </tr>
            ) : null}

            {filteredOwners.map((owner) => (
              <tr key={owner.id} className="align-top">
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">{owner.full_name}</td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">{formatCellValue(owner.email)}</td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">{formatCellValue(owner.phone)}</td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">{formatLocationsCount(owner.locations_count)}</td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={getOwnerEditPath(owner.id)}
                      aria-label="Editar"
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                    >
                      <EditIcon />
                      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                        Editar
                      </span>
                    </Link>

                    <ActionIconButton
                      actionLabel={
                        activeActionKey === `delete:${owner.id}`
                          ? 'Eliminando...'
                          : 'Eliminar'
                      }
                      buttonClassName="border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-50"
                      disabled={activeActionKey !== null}
                      onClick={() => void onDelete(owner)}
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

export default OwnersTable
