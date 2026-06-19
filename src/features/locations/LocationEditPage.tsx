import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import {
  getCategoryEditPath,
  getOwnerEditPath,
  routePaths,
} from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import LocationForm, { type LocationFormMode } from './LocationForm'
import { getLocationById } from './locations.service'
import type { LocationEditableRecord, LocationFormValues } from './locations.types'

type OwnerLocationBreadcrumbState = {
  source: 'owner'
  ownerId: string
  ownerName: string
}

type CategoryLocationBreadcrumbState = {
  source: 'category'
  categoryId: string
  categoryName: string
}

type LocationBreadcrumbState =
  | OwnerLocationBreadcrumbState
  | CategoryLocationBreadcrumbState

function mapRecordToFormValues(record: LocationEditableRecord): LocationFormValues {
  return {
    title: record.title,
    slug: record.slug,
    description: record.description ?? '',
    category_id: record.category_id ?? '',
    department_id: record.department_id ?? '',
    zone_id: record.zone_id ?? '',
    owner_id: record.owner_id ?? '',
    status: record.status ?? 'draft',
    published: record.published ?? false,
    premium: record.premium ?? false,
    featured: record.featured ?? false,
    visibility_level: record.visibility_level ?? 'public',
    address_private: record.address_private ?? '',
    address_public: record.address_public ?? '',
    google_place_id: record.google_place_id,
    formatted_address: record.formatted_address,
    google_department_name: record.google_department_name,
    google_zone_name: record.google_zone_name,
    address_components: record.address_components,
    lat: record.lat,
    lng: record.lng,
    approx_lat: record.approx_lat,
    approx_lng: record.approx_lng,
    show_exact_location: record.show_exact_location ?? false,
    map_visibility: record.map_visibility ?? 'public',
    selectedFeatureIds: record.selectedFeatureIds,
  }
}

function formatLocationCode(locationCode: string | null) {
  const normalizedCode = locationCode?.trim()

  return normalizedCode ? normalizedCode.replaceAll('-', ' ') : null
}

function isMissingLocationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLocaleLowerCase()

  return (
    normalizedMessage.includes('cannot coerce the result to a single json object') ||
    normalizedMessage.includes('no rows returned') ||
    normalizedMessage.includes('not found')
  )
}

function LocationEditPage() {
  const { id } = useParams<{ id: string }>()
  const routerLocation = useLocation()
  const [initialValues, setInitialValues] = useState<LocationFormValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [locationIdentifier, setLocationIdentifier] = useState<string | null>(null)
  const navigationState = routerLocation.state as LocationBreadcrumbState | null
  const ownerContext =
    navigationState?.source === 'owner' &&
    navigationState.ownerId &&
    navigationState.ownerName
      ? navigationState
      : null
  const categoryContext =
    navigationState?.source === 'category' &&
    navigationState.categoryId &&
    navigationState.categoryName
      ? navigationState
      : null

  useEffect(() => {
    let isActive = true

    if (!id) {
      return
    }

    void getLocationById(id)
      .then((record) => {
        if (!isActive) {
          return
        }

        setInitialValues(mapRecordToFormValues(record))
        setLocationIdentifier(formatLocationCode(record.location_code))
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        console.error('No pudimos cargar la locación en LocationEditPage.', error)

        const message =
          isMissingLocationError(error)
            ? 'LOCATION_NOT_FOUND'
            : 'No pudimos cargar la locación.'

        setErrorMessage(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [id])

  const breadcrumbCurrentLabel = !id
    ? 'Editar locación'
    : isLoading
      ? 'Cargando...'
      : !errorMessage && locationIdentifier
        ? locationIdentifier
        : 'Editar locación'
  const pageTitle =
    id && !isLoading && !errorMessage && locationIdentifier
      ? locationIdentifier
      : 'Editar locación'
  const pageDescription =
    id && !isLoading && !errorMessage && locationIdentifier
      ? 'Editá la información, imágenes y configuración de esta locación.'
      : undefined
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: ownerContext
        ? [
            { label: 'Listado de dueños', to: routePaths.owners },
            {
              label: ownerContext.ownerName,
              to: getOwnerEditPath(ownerContext.ownerId),
            },
            { label: breadcrumbCurrentLabel },
          ]
        : categoryContext
          ? [
              { label: 'Listado de categorías', to: routePaths.categories },
              {
                label: categoryContext.categoryName,
                to: getCategoryEditPath(categoryContext.categoryId),
              },
              { label: breadcrumbCurrentLabel },
            ]
          : [
            { label: 'Listado de locaciones', to: routePaths.locations },
            { label: breadcrumbCurrentLabel },
          ],
      title: pageTitle,
      description: pageDescription,
    }),
    [
      breadcrumbCurrentLabel,
      categoryContext,
      ownerContext,
      pageDescription,
      pageTitle,
    ],
  )

  useLayoutHeader(headerConfig)

  if (!id) {
    return (
      <PageContainer
        title="Editar locación"
        description="Actualizá la información principal de la locación reutilizando el formulario base del panel."
        hideHeader
      >
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar la locación
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No encontramos el identificador de la locación.
            </p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={pageTitle}
      description={pageDescription ?? 'Actualizá la información principal de la locación reutilizando el formulario base del panel.'}
      hideHeader
    >
      <Card className="border-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.10),_transparent_24%),linear-gradient(180deg,_#111111_0%,_#151515_52%,_#1a1a1a_100%)] p-6 shadow-none backdrop-blur-0">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando locación...</p>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {errorMessage === 'LOCATION_NOT_FOUND'
                ? 'Locación no encontrada'
                : 'No pudimos cargar la locación'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorMessage === 'LOCATION_NOT_FOUND'
                ? 'La locación que intentás visualizar no existe o fue eliminada.'
                : errorMessage}
            </p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && initialValues && id ? (
          <LocationForm
            mode={'edit' satisfies LocationFormMode}
            locationId={id}
            initialValues={initialValues}
            showImagesSection
            showAdvancedSection={false}
          />
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default LocationEditPage
