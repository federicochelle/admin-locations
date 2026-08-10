import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import useAuth from '../auth/useAuth'
import { createActivityLog } from '../activity/activity-logs.service'
import LocationDeleteProgressModal from './LocationDeleteProgressModal'
import LocationsTable from './LocationsTable'
import type { LocationListItem } from './locations.types'
import { useLocations } from './useLocations'

function formatLocationIdentifier(location: Pick<LocationListItem, 'locationCode' | 'title'>) {
  const locationCode = location.locationCode?.trim()

  if (locationCode) {
    return locationCode.replaceAll('-', ' ')
  }

  const title = location.title.trim()

  return title.length > 0 ? title : 'esta locación'
}

function LocationsPage() {
  const { profile } = useAuth()
  const {
    actionErrorMessage,
    activeActionKey,
    currentPage,
    errorMessage,
    isLoading,
    locations,
    remove,
    retry,
    searchTerm,
    setCurrentPage,
    setSearchTerm,
    setSort,
    sortDirection,
    sortKey,
    totalCount,
  } = useLocations()

  async function handleDelete(location: LocationListItem) {
    const shouldDelete = window.confirm(
      `¿Seguro que querés eliminar la locación "${formatLocationIdentifier(location)}"?\n\nEsta acción no se puede deshacer.`,
    )

    if (!shouldDelete) {
      return
    }

    const locationCode = location.locationCode?.trim() ?? ''
    const locationTitle = location.title.trim()
    const entityName = locationCode || locationTitle || 'Sin código'

    if (profile?.id) {
      try {
        await createActivityLog({
          actorProfileId: profile.id,
          action: 'deleted',
          entityType: 'location',
          entityId: location.id,
          entityName,
        })
      } catch (error) {
        console.warn('No pudimos registrar activity_log para delete de location.', error)
      }
    } else {
      console.warn('No se registró activity_log para delete de location porque falta actorProfileId.')
    }

    await remove(location.id)
  }

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Locaciones' }],
      title: 'Locaciones',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Locaciones"
      description="Espacio principal para administrar el inventario de locaciones audiovisuales."
      hideHeader
    >
      <LocationDeleteProgressModal
        isOpen={activeActionKey?.startsWith('delete:') ?? false}
      />

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando locaciones...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las locaciones
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && actionErrorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos actualizar la locación
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {actionErrorMessage}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage ? (
        <LocationsTable
          locations={locations}
          activeActionKey={activeActionKey}
          currentPage={currentPage}
          pageSize={30}
          searchTerm={searchTerm}
          sortDirection={sortDirection}
          sortKey={sortKey}
          totalCount={totalCount}
          visibleColumns={{ actions: false }}
          onPageChange={setCurrentPage}
          onSearchTermChange={setSearchTerm}
          onSortChange={setSort}
          onDelete={handleDelete}
        />
      ) : null}
    </PageContainer>
  )
}

export default LocationsPage
