import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import { Link, useNavigate } from 'react-router-dom'
import {
  getLocationDetailPath,
  getLocationEditPath,
  routePaths,
} from '../../app/router/route-paths'
import {
  formatOwnerPhoneForDisplay,
  getOwnerWhatsappUrl,
} from '../../lib/phone'
import OwnerDetailsModal from '../owners/OwnerDetailsModal'
import type {
  LocationListItem,
  LocationSortDirection,
  LocationSortKey,
} from './locations.types'

type LocationEditState = {
  source: 'category'
  categoryId: string
  categoryName: string
}

type OwnerLocationEditState = {
  source: 'owner'
  ownerId: string
  ownerName: string
}

type VisibleColumns = {
  cover?: boolean
  code?: boolean
  department?: boolean
  owner?: boolean
  phone?: boolean
  actions?: boolean
}

type LocationsTableProps = {
  locations: LocationListItem[]
  activeActionKey: string | null
  headerAction?: React.ReactNode
  searchPlaceholder?: string
  showToolbar?: boolean
  title?: string | null
  visibleColumns?: VisibleColumns
  getLocationEditState?: (
    location: LocationListItem,
  ) => LocationEditState | OwnerLocationEditState | undefined
  currentPage?: number
  pageSize?: number
  searchTerm?: string
  sortKey?: LocationSortKey
  sortDirection?: LocationSortDirection
  totalCount?: number
  onPageChange?: (page: number) => void
  onSearchTermChange?: (value: string) => void
  onSortChange?: (key: LocationSortKey) => void
  onDelete: (location: LocationListItem) => Promise<void>
}

function formatCellValue(value: string | null) {
  const hasValue = value && value.trim().length > 0

  return (
    <span className={hasValue ? 'text-slate-900' : 'text-slate-500'}>
      {hasValue ? value : '-'}
    </span>
  )
}

function formatLocationCode(locationCode: string | null) {
  const normalizedCode = locationCode?.trim()

  if (!normalizedCode) {
    return <span className="text-slate-500">-</span>
  }

  return normalizedCode.replaceAll('-', ' ')
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\s-_]+/g, '')
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-24 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
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

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
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
  searchPlaceholder = 'Buscar por código o dueño',
  showToolbar = true,
  title = 'Listado de locaciones',
  visibleColumns,
  getLocationEditState,
  currentPage,
  pageSize,
  searchTerm,
  sortKey,
  sortDirection,
  totalCount,
  onPageChange,
  onSearchTermChange,
  onSortChange,
  onDelete,
}: LocationsTableProps) {
  const navigate = useNavigate()
  const [internalSearchTerm, setInternalSearchTerm] = useState('')
  const [internalSortKey, setInternalSortKey] = useState<LocationSortKey>('locationCode')
  const [internalSortDirection, setInternalSortDirection] = useState<LocationSortDirection>('asc')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)
  const hasTitle = Boolean(title)
  const resolvedSearchTerm = searchTerm ?? internalSearchTerm
  const resolvedSortKey = sortKey ?? internalSortKey
  const resolvedSortDirection = sortDirection ?? internalSortDirection
  const resolvedCurrentPage = currentPage ?? 1
  const resolvedPageSize = pageSize ?? Math.max(locations.length, 1)
  const resolvedTotalCount = totalCount ?? locations.length
  const isServerPaginated = typeof onPageChange === 'function'
  const totalPages = Math.max(1, Math.ceil(resolvedTotalCount / resolvedPageSize))
  const showingFrom = resolvedTotalCount === 0 ? 0 : (resolvedCurrentPage - 1) * resolvedPageSize + 1
  const showingTo = resolvedTotalCount === 0
    ? 0
    : Math.min((resolvedCurrentPage - 1) * resolvedPageSize + locations.length, resolvedTotalCount)
  const resolvedVisibleColumns: Required<VisibleColumns> = {
    cover: visibleColumns?.cover ?? true,
    code: visibleColumns?.code ?? true,
    department: visibleColumns?.department ?? true,
    owner: visibleColumns?.owner ?? true,
    phone: visibleColumns?.phone ?? true,
    actions: visibleColumns?.actions ?? true,
  }
  const normalizedSearchTerm = resolvedSearchTerm.trim()
  const filteredLocations = useMemo(() => {
    if (isServerPaginated) {
      return locations
    }

    const normalizedSearch = normalizeSearchValue(normalizedSearchTerm)

    if (normalizedSearch.length === 0) {
      return locations
    }

    return locations.filter((location) => {
      const searchableFields = [
        location.locationCode ?? '',
        location.ownerName ?? '',
      ]

      return searchableFields.some((field) =>
        normalizeSearchValue(field).includes(normalizedSearch),
      )
    })
  }, [isServerPaginated, locations, normalizedSearchTerm])

  const sortedLocations = useMemo(() => {
    if (isServerPaginated) {
      return locations
    }

    return [...filteredLocations].sort((left, right) => {
      const leftValue =
        resolvedSortKey === 'departmentName'
          ? left.departmentName ?? ''
          : left.locationCode ?? ''
      const rightValue =
        resolvedSortKey === 'departmentName'
          ? right.departmentName ?? ''
          : right.locationCode ?? ''

      const comparison = leftValue.localeCompare(rightValue, 'es', {
        sensitivity: 'base',
        numeric: true,
      })

      return resolvedSortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredLocations, isServerPaginated, locations, resolvedSortDirection, resolvedSortKey])

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages = new Set<number>([1, totalPages, resolvedCurrentPage - 1, resolvedCurrentPage, resolvedCurrentPage + 1])

    return Array.from(pages)
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
      .sort((left, right) => left - right)
  }, [resolvedCurrentPage, totalPages])

  function handleSort(nextSortKey: LocationSortKey) {
    if (onSortChange) {
      onSortChange(nextSortKey)
      return
    }

    if (resolvedSortKey === nextSortKey) {
      setInternalSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      )
      return
    }

    setInternalSortKey(nextSortKey)
    setInternalSortDirection('asc')
  }

  function handleSearchTermChange(value: string) {
    if (onSearchTermChange) {
      onSearchTermChange(value)
      return
    }

    setInternalSearchTerm(value)
  }

  function isInteractiveEventTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="button"]',
      ),
    )
  }

  function handleRowNavigation(
    locationId: string,
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (isInteractiveEventTarget(event.target)) {
      return
    }

    navigate(getLocationDetailPath(locationId))
  }

  const isEmptyState = sortedLocations.length === 0
  const emptyStateContent =
    normalizedSearchTerm.length === 0 && resolvedTotalCount === 0
      ? {
          title: 'Todavia no hay locaciones cargadas.',
          description: 'Crea tu primera locacion para comenzar.',
        }
      : {
          title: 'No se encontraron locaciones.',
          description: 'Proba con otro termino de busqueda.',
        }

  return (
    <>
      {selectedOwnerId ? (
        <OwnerDetailsModal
          key={selectedOwnerId}
          isOpen
          ownerId={selectedOwnerId}
          onClose={() => setSelectedOwnerId(null)}
        />
      ) : null}

      <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
        {showToolbar ? (
        <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
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
                <p className="mt-1 text-sm text-slate-500">
                  {resolvedTotalCount} {resolvedTotalCount === 1 ? 'locación registrada' : 'locaciones registradas'}
                </p>
              </div>
            ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end lg:gap-4">
            <label className="relative block min-w-0 flex-1 sm:min-w-80 lg:min-w-[22rem]">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={resolvedSearchTerm}
                onChange={(event) => handleSearchTermChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                {resolvedVisibleColumns.cover ? 'Portada' : null}
              </th>
              {resolvedVisibleColumns.code ? (
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('locationCode')}
                    className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                  >
                    <span>CÓDIGO</span>
                    <span
                      className={[
                        'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                        resolvedSortKey === 'locationCode'
                          ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                          : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                      ].join(' ')}
                    >
                      <SortIcon isActive={resolvedSortKey === 'locationCode'} />
                    </span>
                  </button>
                </th>
              ) : null}
              {resolvedVisibleColumns.department ? (
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('departmentName')}
                    className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                  >
                    <span>DEPARTAMENTO</span>
                    <span
                      className={[
                        'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                        resolvedSortKey === 'departmentName'
                          ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                          : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                      ].join(' ')}
                    >
                      <SortIcon isActive={resolvedSortKey === 'departmentName'} />
                    </span>
                  </button>
                </th>
              ) : null}
              {resolvedVisibleColumns.owner ? (
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Dueño
                </th>
              ) : null}
              {resolvedVisibleColumns.phone ? (
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Teléfono
                </th>
              ) : null}
              {resolvedVisibleColumns.actions ? (
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Acciones
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {sortedLocations.map((location) => (
              <tr
                key={location.id}
                className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)] focus:bg-[rgba(184,146,74,0.10)] focus:outline-none"
                onClick={(event) => handleRowNavigation(location.id, event)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  handleRowNavigation(location.id, event)
                }}
                tabIndex={0}
              >
                {resolvedVisibleColumns.cover ? (
                  <td className="px-3 py-4 sm:px-6">
                    {location.coverImageUrl ? (
                      <div className="h-14 w-24 overflow-hidden border border-slate-200 bg-slate-100">
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
                ) : null}
                {resolvedVisibleColumns.code ? (
                  <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                    {formatLocationCode(location.locationCode)}
                  </td>
                ) : null}
                {resolvedVisibleColumns.department ? (
                  <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                    {formatCellValue(location.departmentName)}
                  </td>
                ) : null}
                {resolvedVisibleColumns.owner ? (
                  <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                    {location.ownerId && location.ownerName ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedOwnerId(location.ownerId)
                        }}
                        className="font-medium text-slate-900 underline-offset-4 transition hover:underline"
                      >
                        {location.ownerName}
                      </button>
                    ) : (
                      formatCellValue(location.ownerName)
                    )}
                  </td>
                ) : null}
                {resolvedVisibleColumns.phone ? (
                  <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                    {(() => {
                      const whatsappUrl = getOwnerWhatsappUrl(location.ownerPhone)
                      const formattedPhone = formatOwnerPhoneForDisplay(location.ownerPhone)

                      if (!location.ownerPhone || location.ownerPhone.trim().length === 0) {
                        return formatCellValue(location.ownerPhone)
                      }

                      if (!whatsappUrl) {
                        return <span>{formattedPhone}</span>
                      }

                      return (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-slate-900 underline-offset-4 transition hover:cursor-pointer hover:underline"
                        >
                          {formattedPhone}
                        </a>
                      )
                    })()}
                  </td>
                ) : null}
                {resolvedVisibleColumns.actions ? (
                  <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                    <div className="flex flex-nowrap items-center gap-2">
                      <Link
                        to={getLocationEditPath(location.id)}
                        state={getLocationEditState?.(location)}
                        onClick={(event) => event.stopPropagation()}
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
                        buttonClassName="border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-50"
                        disabled={activeActionKey !== null}
                        onClick={() => void onDelete(location)}
                      >
                        <DeleteIcon />
                      </ActionIconButton>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}

        {!isEmptyState && isServerPaginated ? (
          <div className="flex flex-col gap-4 border-t border-slate-200 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-600">
              Mostrando {showingFrom}–{showingTo} de {resolvedTotalCount}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={resolvedCurrentPage <= 1}
                onClick={() => onPageChange?.(resolvedCurrentPage - 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronIcon direction="left" />
                Anterior
              </button>

              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => onPageChange?.(pageNumber)}
                  className={[
                    'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition',
                    pageNumber === resolvedCurrentPage
                      ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#8a6c16]'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                disabled={resolvedCurrentPage >= totalPages}
                onClick={() => onPageChange?.(resolvedCurrentPage + 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
                <ChevronIcon direction="right" />
              </button>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  )
}

export default LocationsTable
