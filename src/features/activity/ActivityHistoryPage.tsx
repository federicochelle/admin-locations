import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import TablePagination from '../../components/ui/TablePagination'
import {
  formatActivityEntityName,
  formatRelativeCreatedAt,
  getActivityEntityPath,
} from './activity-logs.helpers'
import type { ActivityLogListItem } from './activity-logs.service'
import { useActivityLogs } from './useActivityLogs'

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

function getActivityTypeLabel(entityType: ActivityLogListItem['entity_type']) {
  if (entityType === 'location') {
    return 'Locación'
  }

  if (entityType === 'owner') {
    return 'Dueño'
  }

  if (entityType === 'category') {
    return 'Categoría'
  }

  if (entityType === 'zone') {
    return 'Zona'
  }

  return '-'
}

function getActivityActionCellLabel(action: ActivityLogListItem['action']) {
  if (action === 'created') {
    return 'Creó'
  }

  if (action === 'updated') {
    return 'Editó'
  }

  if (action === 'deleted') {
    return 'Eliminó'
  }

  return '-'
}

function ActivityHistoryPage() {
  const navigate = useNavigate()
  const {
    activityLogs,
    currentPage,
    pageSize,
    totalCount,
    searchTerm,
    isLoading,
    errorMessage,
    loadActivityLogs,
    setCurrentPage,
    setSearchTerm,
  } = useActivityLogs()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Historial' }],
      title: 'Historial de actividad',
      description: 'Registro de acciones realizadas dentro del panel administrativo.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Historial de actividad"
      description="Registro de acciones realizadas dentro del panel administrativo."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando historial...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar el historial
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void loadActivityLogs()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage ? (
        <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
          <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-end">
              <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
                <label className="relative block min-w-0 sm:w-80">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    placeholder="Buscar acción, usuario o nombre"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            </div>
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                title={
                  searchTerm.trim().length === 0
                    ? 'No hay actividad registrada'
                    : 'No se encontraron actividades'
                }
                description={
                  searchTerm.trim().length === 0
                    ? 'Las acciones realizadas en el panel aparecerán aquí.'
                    : 'Probá con otra búsqueda para ver más resultados.'
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-[#f3f2ee]">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                        Usuario
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                        Acción
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                        Nombre
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                        Tipo
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-transparent">
                    {activityLogs.map((log) => {
                      const entityName = formatActivityEntityName(log)
                      const entityPath = getActivityEntityPath(log)

                      return (
                        <tr key={log.id} className="align-top">
                          <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                            {log.actor_name || '-'}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                            {getActivityActionCellLabel(log.action)}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                            {entityPath ? (
                              <button
                                type="button"
                                onClick={() => navigate(entityPath)}
                                className="font-medium text-slate-900 underline-offset-4 transition hover:cursor-pointer hover:underline"
                              >
                                {entityName}
                              </button>
                            ) : (
                              <span>{entityName}</span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                            {getActivityTypeLabel(log.entity_type)}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-500 sm:px-6">
                            {formatRelativeCreatedAt(log.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                itemCount={activityLogs.length}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </Card>
      ) : null}
    </PageContainer>
  )
}

export default ActivityHistoryPage
