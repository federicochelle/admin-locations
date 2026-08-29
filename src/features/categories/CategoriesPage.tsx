import { useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import LocationDeleteProgressModal from '../locations/LocationDeleteProgressModal'
import CategoriesTable from './CategoriesTable'
import LocationsTable from '../locations/LocationsTable'
import {
  deleteLocation,
  getLocationsByCategory,
} from '../locations/locations.service'
import type { LocationListItem } from '../locations/locations.types'
import type { CategoryListItem } from './categories.types'
import { useCategories } from './useCategories'

function formatLocationIdentifier(location: Pick<LocationListItem, 'locationCode' | 'title'>) {
  const locationCode = location.locationCode?.trim()

  if (locationCode) {
    return locationCode.replaceAll('-', ' ')
  }

  const title = location.title.trim()

  return title.length > 0 ? title : 'esta locación'
}

function CategoriesPage() {
  const {
    actionErrorMessage,
    activeActionKey,
    categories,
    currentPage,
    errorMessage,
    isLoading,
    pageSize,
    remove,
    retry,
    searchTerm,
    setCurrentPage,
    setSearchTerm,
    setSort,
    sortKey,
    totalCount,
  } = useCategories()
  const [selectedCategory, setSelectedCategory] = useState<CategoryListItem | null>(null)
  const [categoryLocations, setCategoryLocations] = useState<LocationListItem[]>([])
  const [isLocationsLoading, setIsLocationsLoading] = useState(false)
  const [locationsErrorMessage, setLocationsErrorMessage] = useState<string | null>(
    null,
  )
  const [locationsActionErrorMessage, setLocationsActionErrorMessage] = useState<string | null>(
    null,
  )
  const [locationsActionKey, setLocationsActionKey] = useState<string | null>(null)

  function resetSelectedCategory() {
    setSelectedCategory(null)
    setCategoryLocations([])
    setLocationsErrorMessage(null)
    setLocationsActionErrorMessage(null)
  }

  async function handleDelete(category: CategoryListItem) {
    if (category.locationsCount > 0) {
      window.alert(
        'No se puede eliminar la categoría porque tiene locaciones asociadas.\n\nPrimero eliminá o reasigná esas locaciones a otra categoría.',
      )

      return
    }

    await remove(category.id)
  }

  async function loadSelectedCategoryLocations(category: CategoryListItem) {
    setSelectedCategory(category)
    setIsLocationsLoading(true)
    setLocationsErrorMessage(null)

    try {
      const nextLocations = await getLocationsByCategory(category.id)
      setCategoryLocations(nextLocations)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las locaciones de esta categoría.'

      setLocationsErrorMessage(message)
      setCategoryLocations([])
    } finally {
      setIsLocationsLoading(false)
    }
  }

  async function handleView(category: CategoryListItem) {
    await loadSelectedCategoryLocations(category)
  }

  async function runLocationAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    if (!selectedCategory) {
      return
    }

    try {
      setLocationsActionKey(actionKey)
      setLocationsActionErrorMessage(null)

      await action()
      await loadSelectedCategoryLocations(selectedCategory)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos actualizar la locación.'

      setLocationsActionErrorMessage(message)
    } finally {
      setLocationsActionKey(null)
    }
  }

  async function handleDeleteLocation(location: LocationListItem) {
    const shouldDelete = window.confirm(
      `¿Seguro que querés eliminar la locación "${formatLocationIdentifier(location)}"?\n\nEsta acción no se puede deshacer.`,
    )

    if (!shouldDelete) {
      return
    }

    await runLocationAction(`delete:${location.id}`, () => deleteLocation(location.id))
  }

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: selectedCategory
        ? [
            {
              label: 'Categorías',
              to: routePaths.categories,
              onClick: resetSelectedCategory,
            },
            { label: selectedCategory.name },
          ]
        : [{ label: 'Categorías' }],
      title: selectedCategory ? selectedCategory.name : 'Categorías',
      description: selectedCategory
        ? 'Listado de locaciones asociadas a esta categoría.'
        : 'Administrá las clasificaciones principales que ordenan el catálogo de locaciones y su estructura base.',
    }),
    [selectedCategory],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title="Categorías"
      description="Administrá las clasificaciones principales que ordenan el catálogo de locaciones y su estructura base."
      hideHeader
    >
      <LocationDeleteProgressModal
        isOpen={locationsActionKey?.startsWith('delete:') ?? false}
      />

      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando categorías...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las categorías
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
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos actualizar la categoría
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionErrorMessage}
            </p>
          </div>
        </Card>
      ) : null}

      {selectedCategory ? (
        <>
          {isLocationsLoading ? (
            <Card>
              <div className="flex min-h-48 items-center justify-center">
                <p className="text-sm text-slate-600">
                  Cargando locaciones de {selectedCategory.name}...
                </p>
              </div>
            </Card>
          ) : null}

          {!isLocationsLoading && locationsErrorMessage ? (
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    No pudimos cargar las locaciones de {selectedCategory.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {locationsErrorMessage}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void loadSelectedCategoryLocations(selectedCategory)}
                >
                  Reintentar
                </Button>
              </div>
            </Card>
          ) : null}

          {!isLocationsLoading && !locationsErrorMessage && locationsActionErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos actualizar la locación
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {locationsActionErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {!isLocationsLoading &&
          !locationsErrorMessage &&
          categoryLocations.length === 0 ? (
            <Card className="p-4 sm:p-6">
              <EmptyState
                title={`No hay locaciones en ${selectedCategory.name}`}
                description="Cuando una locación se asocie a esta categoría, aparecerá en este listado."
              />
            </Card>
          ) : null}

          {!isLocationsLoading &&
          !locationsErrorMessage &&
          categoryLocations.length > 0 ? (
            <LocationsTable
              locations={categoryLocations}
              activeActionKey={locationsActionKey}
              getLocationEditState={() => ({
                source: 'category',
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
              })}
              headerAction={
                <Button
                  variant="secondary"
                  onClick={resetSelectedCategory}
                >
                  Volver a categorías
                </Button>
              }
              searchPlaceholder="Buscar locación, dueño o zona"
              title={`Listado de ${selectedCategory.name}`}
              onDelete={handleDeleteLocation}
            />
          ) : null}
        </>
      ) : null}

      {!selectedCategory && !isLoading && !errorMessage && categories.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay categorías cargadas"
            description="Cuando agregues categorías, acá aparecerá el listado completo."
          />
        </Card>
      ) : null}

      {!selectedCategory && !isLoading && !errorMessage && categories.length > 0 ? (
        <CategoriesTable
          categories={categories}
          activeActionKey={activeActionKey}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          searchTerm={searchTerm}
          sortKey={sortKey}
          onPageChange={setCurrentPage}
          onSearchTermChange={setSearchTerm}
          onSortChange={setSort}
          onDelete={handleDelete}
          onView={handleView}
        />
      ) : null}
    </PageContainer>
  )
}

export default CategoriesPage
