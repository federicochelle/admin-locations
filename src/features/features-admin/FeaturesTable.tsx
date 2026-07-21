import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import { getFeatureEditPath } from '../../app/router/route-paths'
import type { FeatureListItem } from './features.types'

type FeaturesTableProps = {
  features: FeatureListItem[]
  activeActionKey: string | null
  onDelete: (id: string) => Promise<void>
}

function formatCellValue(value: string | null) {
  return value && value.trim().length > 0 ? value : '-'
}

function formatActive(active: boolean | null) {
  if (active === true) {
    return 'Sí'
  }

  if (active === false) {
    return 'No'
  }

  return '-'
}

function ActionIconButton({
  actionLabel,
  children,
  disabled = false,
  onClick,
}: {
  actionLabel: string
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
      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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

function FeaturesTable({
  features,
  activeActionKey,
  onDelete,
}: FeaturesTableProps) {
  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <h2 className="text-lg font-semibold text-slate-950">Listado de features</h2>
        <p className="mt-1 text-sm text-slate-600">
          {features.length} features encontradas
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Nombre</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Slug</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Grupo</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Tipo</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Activa</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/95 backdrop-blur-sm">
            {features.map((feature) => (
              <tr key={feature.id} className="align-top">
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">{feature.name}</td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">{feature.slug}</td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">{formatCellValue(feature.group)}</td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">{formatCellValue(feature.type)}</td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">{formatActive(feature.active)}</td>
                <td className="px-3 py-4 text-sm text-slate-600 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={getFeatureEditPath(feature.id)}
                      aria-label="Editar"
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                    >
                      <EditIcon />
                      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                        Editar
                      </span>
                    </Link>

                    <ActionIconButton
                      actionLabel={
                        activeActionKey === `delete:${feature.id}`
                          ? 'Eliminando...'
                          : 'Eliminar'
                      }
                      disabled={activeActionKey !== null}
                      onClick={() => void onDelete(feature.id)}
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

export default FeaturesTable
