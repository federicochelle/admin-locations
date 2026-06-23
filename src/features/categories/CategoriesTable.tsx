import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import { getCategoryEditPath, routePaths } from '../../app/router/route-paths'
import type { CategoryListItem } from './categories.types'

type CategoriesTableProps = {
  categories: CategoryListItem[]
  activeActionKey: string | null
  onDelete: (category: CategoryListItem) => Promise<void>
  onView: (category: CategoryListItem) => void
}

type CategorySortKey = 'name' | 'locationsCount'
type CategorySortDirection = 'asc' | 'desc'

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-20 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
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

function CategoriesTable({
  categories,
  activeActionKey,
  onDelete,
  onView,
}: CategoriesTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<CategorySortKey>('name')
  const [sortDirection, setSortDirection] = useState<CategorySortDirection>('asc')

  const filteredCategories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase()

    const nextCategories =
      normalizedSearch.length === 0
        ? categories
        : categories.filter((category) =>
            category.name.toLocaleLowerCase().includes(normalizedSearch),
          )

    return [...nextCategories].sort((left, right) => {
      if (sortKey === 'locationsCount') {
        const difference = left.locationsCount - right.locationsCount
        return sortDirection === 'asc' ? difference : -difference
      }

      const comparison = left.name.localeCompare(right.name, 'es', {
        sensitivity: 'base',
      })

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [categories, searchTerm, sortDirection, sortKey])

  function handleSort(nextSortKey: CategorySortKey) {
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

  function handleRowView(
    category: CategoryListItem,
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (isInteractiveEventTarget(event.target)) {
      return
    }

    onView(category)
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-end">
          <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Buscar categoría o slug"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <Link
              to={routePaths.categoryNew}
              className={[buttonBaseClassName, buttonVariantClasses.primary, 'gap-2 py-2.5'].join(' ')}
            >
              <PlusIcon />
              Nueva categoría
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                FOTO
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                >
                  <span>NOMBRE</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'name'
                        ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                        : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                    ].join(' ')}
                  >
                    <SortIcon isActive={sortKey === 'name'} />
                  </span>
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">
                <button
                  type="button"
                  onClick={() => handleSort('locationsCount')}
                  className="inline-flex items-center gap-3 transition hover:text-[#C9A227]"
                >
                  <span>LOCACIONES ASOCIADAS</span>
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
                      sortKey === 'locationsCount'
                        ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]'
                        : 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#C9A227]',
                    ].join(' ')}
                  >
                    <SortIcon isActive={sortKey === 'locationsCount'} />
                  </span>
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-sm text-slate-500">
                  No se encontraron categorías.
                </td>
              </tr>
            ) : null}

            {filteredCategories.map((category) => (
              <tr
                key={category.id}
                className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)] focus:bg-[rgba(184,146,74,0.10)] focus:outline-none"
                onClick={(event) => handleRowView(category, event)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  handleRowView(category, event)
                }}
                tabIndex={0}
              >
                <td className="px-6 py-4">
                  {category.image_url ? (
                    <div className="h-14 w-20 overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <CoverPlaceholder />
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-950">{category.name}</td>
                <td className="px-6 py-4 text-sm text-slate-900">{category.locationsCount}</td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={getCategoryEditPath(category.id)}
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
                        activeActionKey === `delete:${category.id}`
                          ? 'Eliminando...'
                          : 'Eliminar'
                      }
                      buttonClassName="border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-50"
                      disabled={activeActionKey !== null}
                      onClick={() => void onDelete(category)}
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

export default CategoriesTable
