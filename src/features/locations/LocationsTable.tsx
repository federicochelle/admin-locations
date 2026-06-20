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
import OwnerDetailsModal from '../owners/OwnerDetailsModal'
import type { LocationListItem } from './locations.types'

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
  onDelete: (location: LocationListItem) => Promise<void>
}

type LocationSortKey = 'departmentName' | 'locationCode'
type LocationSortDirection = 'asc' | 'desc'

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

function normalizePhoneForWhatsapp(phone: string): string | null {
  const normalized = phone.replace(/[\s\-()]/g, '').replace(/\+/g, '')

  if (normalized.length === 0) {
    return null
  }

  let normalizedPhone = normalized

  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = `598${normalizedPhone.slice(1)}`
  } else if (!normalizedPhone.startsWith('598')) {
    normalizedPhone = `598${normalizedPhone}`
  }

  return normalizedPhone.length >= 11 ? normalizedPhone : null
}

function getWhatsappUrl(phone: string | null) {
  if (!phone || phone.trim().length === 0) {
    return null
  }

  const normalizedPhone = normalizePhoneForWhatsapp(phone)

  return normalizedPhone ? `https://wa.me/${normalizedPhone}` : null
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
  searchPlaceholder = 'Buscar locación, categoría o zona',
  showToolbar = true,
  title = 'Listado de locaciones',
  visibleColumns,
  getLocationEditState,
  onDelete,
}: LocationsTableProps) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<LocationSortKey>('departmentName')
  const [sortDirection, setSortDirection] = useState<LocationSortDirection>('asc')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)
  const hasTitle = Boolean(title)
  const resolvedVisibleColumns: Required<VisibleColumns> = {
    cover: visibleColumns?.cover ?? true,
    code: visibleColumns?.code ?? true,
    department: visibleColumns?.department ?? true,
    owner: visibleColumns?.owner ?? true,
    phone: visibleColumns?.phone ?? true,
    actions: visibleColumns?.actions ?? true,
  }
  const normalizedSearchTerm = searchTerm.trim()
  const filteredLocations = useMemo(() => {
    const normalizedSearch = normalizedSearchTerm.toLocaleLowerCase()

    if (normalizedSearch.length === 0) {
      return locations
    }

    return locations.filter((location) => {
      const searchableFields = [
        location.title,
        location.locationCode ?? '',
        location.categoryName ?? '',
        location.departmentName ?? '',
        location.zoneName ?? '',
        location.formattedAddress ?? '',
        location.ownerName ?? '',
        location.ownerPhone ?? '',
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
          : left.locationCode ?? ''
      const rightValue =
        sortKey === 'departmentName'
          ? right.departmentName ?? ''
          : right.locationCode ?? ''

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
    <>
      {selectedOwnerId ? (
        <OwnerDetailsModal
          key={selectedOwnerId}
          isOpen
          ownerId={selectedOwnerId}
          onClose={() => setSelectedOwnerId(null)}
        />
      ) : null}

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
                <p className="mt-1 text-sm text-slate-500">
                  {locations.length} locaciones encontradas
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
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
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
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                {resolvedVisibleColumns.cover ? 'Portada' : null}
              </th>
              {resolvedVisibleColumns.code ? (
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                  <button
                    type="button"
                    onClick={() => handleSort('locationCode')}
                    className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                  >
                    <span>CÓDIGO</span>
                    <span
                      className={[
                        'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                        sortKey === 'locationCode'
                          ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                          : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                      ].join(' ')}
                    >
                      <SortIcon isActive={sortKey === 'locationCode'} />
                    </span>
                  </button>
                </th>
              ) : null}
              {resolvedVisibleColumns.department ? (
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                  <button
                    type="button"
                    onClick={() => handleSort('departmentName')}
                    className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                  >
                    <span>DEPARTAMENTO</span>
                    <span
                      className={[
                        'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                        sortKey === 'departmentName'
                          ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                          : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                      ].join(' ')}
                    >
                      <SortIcon isActive={sortKey === 'departmentName'} />
                    </span>
                  </button>
                </th>
              ) : null}
              {resolvedVisibleColumns.owner ? (
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                  Dueño
                </th>
              ) : null}
              {resolvedVisibleColumns.phone ? (
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                  Teléfono
                </th>
              ) : null}
              {resolvedVisibleColumns.actions ? (
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
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
                ) : null}
                {resolvedVisibleColumns.code ? (
                  <td className="px-6 py-4 text-sm font-medium text-slate-950">
                    {formatLocationCode(location.locationCode)}
                  </td>
                ) : null}
                {resolvedVisibleColumns.department ? (
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {formatCellValue(location.departmentName)}
                  </td>
                ) : null}
                {resolvedVisibleColumns.owner ? (
                  <td className="px-6 py-4 text-sm text-slate-900">
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
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {(() => {
                      const whatsappUrl = getWhatsappUrl(location.ownerPhone)

                      if (!location.ownerPhone || location.ownerPhone.trim().length === 0) {
                        return formatCellValue(location.ownerPhone)
                      }

                      if (!whatsappUrl) {
                        return <span>{location.ownerPhone}</span>
                      }

                      return (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-slate-900 underline-offset-4 transition hover:cursor-pointer hover:underline"
                        >
                          {location.ownerPhone}
                        </a>
                      )
                    })()}
                  </td>
                ) : null}
                {resolvedVisibleColumns.actions ? (
                  <td className="px-6 py-4 text-sm text-slate-900">
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
      </Card>
    </>
  )
}

export default LocationsTable
