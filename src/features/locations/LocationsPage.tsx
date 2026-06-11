import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import LocationsTable from './LocationsTable'
import { useLocations } from './useLocations'

function LocationsPage() {
  const {
    actionErrorMessage,
    activeActionKey,
    errorMessage,
    isLoading,
    locations,
    remove,
    retry,
  } = useLocations()

  async function handleDelete(id: string) {
    const shouldDelete = window.confirm(
      '¿Seguro que querés eliminar esta locación? Esta acción no se puede deshacer y también puede eliminar relaciones asociadas.',
    )

    if (!shouldDelete) {
      return
    }

    await remove(id)
  }

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Listado de locaciones' }],
      title: 'Listado de locaciones',
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

      {!isLoading && !errorMessage && locations.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay locaciones cargadas"
            description="Cuando conectemos Supabase, acá aparecerá el listado de locaciones."
          />
        </Card>
      ) : null}

      {!isLoading && !errorMessage && locations.length > 0 ? (
        <LocationsTable
          locations={locations}
          activeActionKey={activeActionKey}
          title={null}
          onDelete={handleDelete}
        />
      ) : null}
    </PageContainer>
  )
}

export default LocationsPage
