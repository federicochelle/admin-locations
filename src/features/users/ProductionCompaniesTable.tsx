import { useMemo, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import type { ProductionCompanyListItem } from '../production-companies/production-companies.types'

type ProductionCompaniesTableProps = {
  companies: ProductionCompanyListItem[]
  headerCenter?: ReactNode
  isSaving: boolean
  onCreate: () => void
  onEdit: (company: ProductionCompanyListItem) => void
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function getStatusBadgeClassName(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-100 text-slate-600'
}

function ProductionCompaniesTable({
  companies,
  headerCenter,
  isSaving,
  onCreate,
  onEdit,
}: ProductionCompaniesTableProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchTerm.trim())

    return companies.filter((company) => {
      if (normalizedSearch.length === 0) {
        return true
      }

      return normalizeSearchValue(company.name).includes(normalizedSearch)
    })
  }, [companies, searchTerm])

  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Listado de productoras
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {companies.length}{' '}
              {companies.length === 1 ? 'productora registrada' : 'productoras registradas'}
            </p>
          </div>

          {headerCenter ? (
            <div className="flex items-center justify-start lg:justify-center">
              {headerCenter}
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <label className="relative block min-w-0 lg:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Buscar productora"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <Button className="gap-2 py-2.5" onClick={onCreate} disabled={isSaving}>
              <PlusIcon />
              Nueva productora
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Logo
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Nombre
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Estado
              </th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No se encontraron productoras con los filtros actuales.
                </td>
              </tr>
            ) : null}

            {filteredCompanies.map((company) => (
              <tr key={company.id} className="align-top">
                <td className="px-3 py-4 sm:px-6">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={`Logo de ${company.name}`}
                      className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      N/A
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                  {company.name}
                </td>
                <td className="px-3 py-4 text-sm sm:px-6">
                  <span
                    className={[
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                      getStatusBadgeClassName(company.active),
                    ].join(' ')}
                  >
                    {company.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-3 py-4 sm:px-6">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onEdit(company)}
                      disabled={isSaving}
                    >
                      Editar
                    </Button>
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

export default ProductionCompaniesTable
