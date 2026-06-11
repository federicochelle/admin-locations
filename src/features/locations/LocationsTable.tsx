import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import { Link } from 'react-router-dom'
import {
  getLocationEditPath,
  routePaths,
} from '../../app/router/route-paths'
import type { LocationListItem } from './locations.types'

type LocationEditState = {
  source: 'category'
  categoryId: string
  categoryName: string
}

type LocationsTableProps = {
  locations: LocationListItem[]
  activeActionKey: string | null
  headerAction?: React.ReactNode
  searchPlaceholder?: string
  showToolbar?: boolean
  title?: string | null
  getLocationEditState?: (location: LocationListItem) => LocationEditState | undefined
  onDelete: (id: string) => Promise<void>
}

type LocationSortKey = 'departmentName' | 'slug'
type LocationSortDirection = 'asc' | 'desc'

function formatCellValue(value: string | null) {
  return value && value.trim().length > 0 ? value : 'Sin dato'
}

function formatLocationCode() {
  return 'xxxx-xxxx'
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-20 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
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

function SortIcon({ isActive = false }: { isActive?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className={[
        'h-3.5 w-3.5 transition',
        isActive ? 'text-slate-700' : 'text-slate-400',
      ].join(' ')}
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

function ActionIconButton({
  actionLabel,
  buttonClassName = '',
  children,
  disabled = false,
  onClick,
}: {
  actionLabel: string
  buttonClassName?: string
  children: React.ReactNode
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

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M3 6h18"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LocationsTable({
  locations,
  activeActionKey,
  headerAction,
  searchPlaceholder = 'Buscar locación, categoría o zona',
  showToolbar = true,
  title = 'Listado de locaciones',
  getLocationEditState,
  onDelete,
}: LocationsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<LocationSortKey>('departmentName')
  const [sortDirection, setSortDirection] = useState<LocationSortDirection>('asc')
  const hasTitle = Boolean(title)
  const normalizedSearchTerm = searchTerm.trim()
  const filteredLocations = useMemo(() => {
    const normalizedSearch = normalizedSearchTerm.toLocaleLowerCase()

    if (normalizedSearch.length === 0) {
      return locations
    }

    return locations.filter((location) => {
      const searchableFields = [
        location.title,
        location.categoryName ?? '',
        location.departmentName ?? '',
        location.zoneName ?? '',
        location.ownerName ?? '',
      ]

      return searchableFields.some((field) =>
        field.toLocaleLowerCase().includes(normalizedSearch),
      )
    })
  }, [locations, normalizedSearchTerm])

  const sortedLocations = useMemo(() => {
    return [...filteredLocations].sort((left, right) => {
      const leftValue =
        sortKey === 'departmentName'
          ? left.departmentName ?? ''
          : left.slug
      const rightValue =
        sortKey === 'departmentName'
          ? right.departmentName ?? ''
          : right.slug

      const comparison = leftValue.localeCompare(rightValue, 'es', {
        sensitivity: 'base',
      })

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredLocations, sortDirection, sortKey])

  function handleSort(nextSortKey: LocationSortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      )
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('asc')
  }

  const isEmptyState = sortedLocations.length === 0
  const emptyStateContent =
    locations.length === 0
      ? {
          title: 'Todavia no hay locaciones cargadas.',
          description: 'Crea tu primera locacion para comenzar.',
        }
      : {
          title: 'No se encontraron locaciones.',
          description: 'Proba con otro termino de busqueda.',
        }

  return (
    <Card className="overflow-hidden p-0">
      {showToolbar ? (
        <div className="border-b border-slate-200 px-6 py-5">
        <div
          className={[
            'flex flex-col gap-4 lg:flex-row lg:items-end',
            hasTitle ? 'lg:justify-between' : 'lg:justify-end',
          ].join(' ')}
        >
            {hasTitle ? (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {locations.length} locaciones encontradas
                </p>
              </div>
            ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end lg:gap-4">
            <label className="relative block min-w-0 flex-1 sm:min-w-80 lg:min-w-[22rem]">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            {headerAction !== undefined ? headerAction : (
              <Link
                to={routePaths.locationNew}
                className={[buttonBaseClassName, buttonVariantClasses.primary, 'gap-2 py-2.5'].join(' ')}
              >
                <PlusIcon />
                Nueva locación
              </Link>
            )}
            </div>
          </div>
        </div>
      ) : null}

      {isEmptyState ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            title={emptyStateContent.title}
            description={emptyStateContent.description}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Portada
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Título
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <button
                  type="button"
                  onClick={() => handleSort('departmentName')}
                  className="inline-flex items-center gap-3 transition hover:text-slate-700"
                >
                  <span>DEPARTAMENTO</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'departmentName'
                        ? 'border-slate-300 bg-white text-slate-700'
                        : 'border-slate-200 bg-white text-slate-400',
                    ].join(' ')}
                  >
                    <SortIcon isActive={sortKey === 'departmentName'} />
                  </span>
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Zona
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Dueño
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <button
                  type="button"
                  onClick={() => handleSort('slug')}
                  className="inline-flex items-center gap-3 transition hover:text-slate-700"
                >
                  <span>CÓDIGO</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'slug'
                        ? 'border-slate-300 bg-white text-slate-700'
                        : 'border-slate-200 bg-white text-slate-400',
                    ].join(' ')}
                  >
                    <SortIcon isActive={sortKey === 'slug'} />
                  </span>
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedLocations.map((location) => (
              <tr key={location.id} className="align-top">
                <td className="px-6 py-4">
                  {location.coverImageUrl ? (
                    <div className="h-14 w-20 overflow-hidden border border-slate-200 bg-slate-100">
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
                <td className="px-6 py-4 text-sm font-medium text-slate-950">
                  {location.title}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatCellValue(location.departmentName)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatCellValue(location.zoneName)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatCellValue(location.ownerName)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatLocationCode()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="flex flex-nowrap items-center gap-2">
                    <Link
                      to={getLocationEditPath(location.id)}
                      state={getLocationEditState?.(location)}
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
                        activeActionKey === `delete:${location.id}`
                          ? 'Eliminando...'
                          : 'Eliminar'
                      }
                      buttonClassName="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                      disabled={activeActionKey !== null}
                      onClick={() => void onDelete(location.id)}
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
      )}
    </Card>
  )
}

export default LocationsTable
