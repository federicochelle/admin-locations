import { createAdminCorrelationId, reportAdminError } from '../../lib/admin-error-reporting'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { useAdminFeedback } from '../../components/ui/admin-feedback/useAdminFeedback'
import PageContainer from '../../components/ui/PageContainer'
import LocationDeleteProgressModal from '../locations/LocationDeleteProgressModal'
import CategoriesTable from './CategoriesTable'
import LocationsTable from '../locations/LocationsTable'
import {
  deleteLocation,
  getLocationsByCategory,
  updateCategoryLocationDisplayOrder,
} from '../locations/locations.service'
import type { LocationListItem } from '../locations/locations.types'
import type { CategoryListItem } from './categories.types'
import {
  getCategoryLocationOrderIds,
  hasCategoryLocationOrderChanges,
  moveCategoryLocationToDisplayOrder,
  renumberCategoryLocations,
} from './category-location-order'
import { useCategories } from './useCategories'

type CategoryLocationsReturnState = {
  source: 'category-locations'
  categoryId: string
}

type CategoryLocationsHistoryMode = 'none' | 'push' | 'replace'

function formatLocationIdentifier(location: Pick<LocationListItem, 'locationCode' | 'title'>) {
  const locationCode = location.locationCode?.trim()

  if (locationCode) {
    return locationCode.replaceAll('-', ' ')
  }

  const title = location.title.trim()

  return title.length > 0 ? title : 'esta locación'
}

function CategoriesPage() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const { toast } = useAdminFeedback()
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
  const [savedCategoryLocationOrderIds, setSavedCategoryLocationOrderIds] = useState<string[]>([])
  const [isLocationsLoading, setIsLocationsLoading] = useState(false)
  const [isOrderSaving, setIsOrderSaving] = useState(false)
  const [locationsErrorMessage, setLocationsErrorMessage] = useState<string | null>(
    null,
  )
  const [locationsActionErrorMessage, setLocationsActionErrorMessage] = useState<string | null>(
    null,
  )
  const [locationsActionKey, setLocationsActionKey] = useState<string | null>(null)
  const restoredCategoryIdRef = useRef<string | null>(null)

  const categoryLocationsReturnState =
    routerLocation.state as CategoryLocationsReturnState | null

  function resetSelectedCategory() {
    setSelectedCategory(null)
    setCategoryLocations([])
    setSavedCategoryLocationOrderIds([])
    setLocationsErrorMessage(null)
    setLocationsActionErrorMessage(null)
  }

  function closeSelectedCategory() {
    restoredCategoryIdRef.current = null
    resetSelectedCategory()
    navigate(routePaths.categories, {
      replace: true,
      state: null,
    })
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

  async function loadSelectedCategoryLocations(
    category: CategoryListItem,
    historyMode: CategoryLocationsHistoryMode = 'none',
  ) {
    restoredCategoryIdRef.current = category.id
    if (historyMode !== 'none') {
      navigate(routePaths.categories, {
        replace: historyMode === 'replace',
        state: {
          source: 'category-locations',
          categoryId: category.id,
        } satisfies CategoryLocationsReturnState,
      })
    }
    setSelectedCategory(category)
    setIsLocationsLoading(true)
    setLocationsErrorMessage(null)

    try {
      const nextLocations = await getLocationsByCategory(category.id)
      const orderedLocations = renumberCategoryLocations(nextLocations)
      setCategoryLocations(orderedLocations)
      setSavedCategoryLocationOrderIds(getCategoryLocationOrderIds(orderedLocations))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las locaciones de esta categoría.'

      setLocationsErrorMessage(message)
      setCategoryLocations([])
      setSavedCategoryLocationOrderIds([])
    } finally {
      setIsLocationsLoading(false)
    }
  }

  async function handleView(category: CategoryListItem) {
    await loadSelectedCategoryLocations(category, 'push')
  }

  useEffect(() => {
    if (
      categoryLocationsReturnState?.source !== 'category-locations' ||
      !categoryLocationsReturnState.categoryId ||
      restoredCategoryIdRef.current === categoryLocationsReturnState.categoryId
    ) {
      return
    }

    const categoryToRestore = categories.find(
      (category) => category.id === categoryLocationsReturnState.categoryId,
    )

    if (!categoryToRestore) {
      return
    }

    restoredCategoryIdRef.current = categoryToRestore.id
    void loadSelectedCategoryLocations(categoryToRestore)
  }, [categories, categoryLocationsReturnState])

  useEffect(() => {
    if (categoryLocationsReturnState?.source === 'category-locations') {
      return
    }

    restoredCategoryIdRef.current = null
    resetSelectedCategory()
  }, [categoryLocationsReturnState])

  async function runLocationAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    if (!selectedCategory) {
      return
    }

    const correlationId = createAdminCorrelationId()
    try {
      setLocationsActionKey(actionKey)
      setLocationsActionErrorMessage(null)

      await action()
      await loadSelectedCategoryLocations(selectedCategory)
    } catch (error) {
      reportAdminError(error, { operation: `location.${actionKey.split(':')[0]}`, resourceId: actionKey.split(':')[1], stage: 'request', provider: 'supabase', correlationId, userFacing: true, outcome: 'unknown' })
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

  function handleLocationOrderChange(locationId: string, nextDisplayOrder: number) {
    setCategoryLocations((currentLocations) =>
      moveCategoryLocationToDisplayOrder(
        currentLocations,
        locationId,
        nextDisplayOrder,
      ),
    )
  }

  async function handleSaveCategoryLocationOrder() {
    if (!selectedCategory || isOrderSaving) {
      return
    }

    const locationIds = getCategoryLocationOrderIds(categoryLocations)
    const correlationId = createAdminCorrelationId()

    try {
      setIsOrderSaving(true)
      setLocationsActionErrorMessage(null)

      await updateCategoryLocationDisplayOrder(selectedCategory.id, locationIds)
      setSavedCategoryLocationOrderIds(locationIds)
      toast({
        variant: 'success',
        title: 'Orden guardado',
        description: 'Actualizamos el orden de las locaciones de esta categoría.',
      })
    } catch (error) {
      reportAdminError(error, {
        operation: 'location.display_order.update',
        resourceId: selectedCategory.id,
        stage: 'request',
        provider: 'supabase',
        correlationId,
        userFacing: true,
        outcome: 'failed',
      })
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos guardar el orden de las locaciones.'

      setLocationsActionErrorMessage(message)
      toast({
        variant: 'error',
        title: 'No pudimos guardar el orden',
        description: message,
      })
    } finally {
      setIsOrderSaving(false)
    }
  }

  const orderSelectOptions = useMemo(
    () =>
      Array.from({ length: categoryLocations.length }, (_, index) => index + 1),
    [categoryLocations.length],
  )

  const hasOrderChanges = useMemo(
    () =>
      hasCategoryLocationOrderChanges(
        categoryLocations,
        savedCategoryLocationOrderIds,
      ),
    [categoryLocations, savedCategoryLocationOrderIds],
  )

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: selectedCategory
        ? [
            {
              label: 'Categorías',
              to: routePaths.categories,
              onClick: closeSelectedCategory,
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
              getLocationDetailState={() => ({
                source: 'category',
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                returnTo: {
                  pathname: routePaths.categories,
                  state: {
                    source: 'category-locations',
                    categoryId: selectedCategory.id,
                  },
                },
              })}
              getLocationEditState={() => ({
                source: 'category',
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                returnTo: {
                  pathname: routePaths.categories,
                  state: {
                    source: 'category-locations',
                    categoryId: selectedCategory.id,
                  },
                },
              })}
              headerAction={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={closeSelectedCategory}
                  >
                    Volver a categorías
                  </Button>
                  <Button
                    disabled={!hasOrderChanges || isOrderSaving}
                    onClick={() => void handleSaveCategoryLocationOrder()}
                  >
                    {isOrderSaving ? 'Guardando...' : 'Guardar orden'}
                  </Button>
                </div>
              }
              visibleColumns={{ actions: false, order: true }}
              disableSorting
              preserveInputOrder
              renderOrderCell={(location) => (
                <select
                  aria-label={`Orden de ${location.title}`}
                  value={location.displayOrder ?? 1}
                  disabled={isOrderSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    handleLocationOrderChange(
                      location.id,
                      Number(event.target.value),
                    )
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {orderSelectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
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
