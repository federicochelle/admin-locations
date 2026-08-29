import { type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import type { ProductionCompanyListItem } from '../production-companies/production-companies.types'

type ProductionCompaniesTableProps = {
  companies: ProductionCompanyListItem[]
  headerCenter?: ReactNode
  isSaving: boolean
  onCreate: () => void
  onDelete: (company: ProductionCompanyListItem) => void
  onEdit: (company: ProductionCompanyListItem) => void
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

function getStatusBadgeClassName(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-100 text-slate-600'
}

function logoCellClassName() {
  return 'flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 p-1'
}

function ProductionCompaniesTable({
  companies,
  headerCenter,
  isSaving,
  onCreate,
  onDelete,
  onEdit,
}: ProductionCompaniesTableProps) {
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

          <div className="flex justify-start lg:justify-end">
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
            {companies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No hay productoras registradas todavía.
                </td>
              </tr>
            ) : null}

            {companies.map((company) => (
              <tr key={company.id} className="align-top">
                <td className="px-3 py-4 sm:px-6">
                  {company.logoUrl ? (
                    <div className={logoCellClassName()}>
                      <img
                        src={company.logoUrl}
                        alt={`Logo de ${company.name}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
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
                      aria-label="Editar"
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 p-0 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                      onClick={() => onEdit(company)}
                      disabled={isSaving}
                    >
                      <EditIcon />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      aria-label="Eliminar"
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-0 text-red-700 transition hover:border-red-300 hover:bg-red-100"
                      onClick={() => onDelete(company)}
                      disabled={isSaving}
                    >
                      <DeleteIcon />
                      <span className="sr-only">Eliminar</span>
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
