import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import {
  getCategoryEditPath,
  getLocationEditPath,
  getOwnerEditPath,
  routePaths,
} from '../../app/router/route-paths'
import useAuth from '../auth/useAuth'
import { createActivityLog } from '../activity/activity-logs.service'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import LocationForm, { type LocationFormMode } from './LocationForm'
import LocationDeleteProgressModal from './LocationDeleteProgressModal'
import { deleteLocation, getLocationById } from './locations.service'
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
    selectedTagIds: record.selectedTagIds,
  }
}

function formatLocationCode(locationCode: string | null) {
  const normalizedCode = locationCode?.trim()

  return normalizedCode ? normalizedCode.replaceAll('-', ' ') : null
}

function formatLocationIdentifier(location: Pick<LocationFormValues, 'title'> & {
  locationCode: string | null
}) {
  const locationCode = location.locationCode?.trim()

  if (locationCode) {
    return locationCode.replaceAll('-', ' ')
  }

  const title = location.title.trim()

  return title.length > 0 ? title : 'esta locación'
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

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M3 6h18"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LocationViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const { profile } = useAuth()
  const [initialValues, setInitialValues] = useState<LocationFormValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [locationIdentifier, setLocationIdentifier] = useState<string | null>(null)
  const [locationCode, setLocationCode] = useState<string | null>(null)
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
        setLocationCode(record.location_code)
        setLocationIdentifier(formatLocationCode(record.location_code))
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        console.error('No pudimos cargar la locación en LocationViewPage.', error)

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
    ? 'Detalle de locación'
    : isLoading
      ? 'Cargando...'
      : !errorMessage && locationIdentifier
        ? locationIdentifier
        : 'Detalle de locación'
  const pageTitle =
    id && !isLoading && !errorMessage && locationIdentifier
      ? locationIdentifier
      : 'Detalle de locación'
  const pageDescription =
    id && !isLoading && !errorMessage && locationIdentifier
      ? 'Visualizá la información, imágenes y configuración de esta locación.'
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
      errorMessage,
      id,
      isLoading,
      ownerContext,
      pageDescription,
      pageTitle,
    ],
  )

  useLayoutHeader(headerConfig)

  async function handleDeleteLocation() {
    if (!id || !initialValues) {
      return
    }

    const formattedLocationIdentifier = formatLocationIdentifier({
      locationCode,
      title: initialValues.title,
    })
    const shouldDelete = window.confirm(
      `¿Seguro que querés eliminar la locación "${formattedLocationIdentifier}"?\n\nEsta acción no se puede deshacer.`,
    )

    if (!shouldDelete) {
      return
    }

    setDeleteErrorMessage(null)
    setIsDeleting(true)

    try {
      const entityName =
        locationCode?.trim() || initialValues.title.trim() || 'Sin código'

      if (profile?.id) {
        try {
          await createActivityLog({
            actorProfileId: profile.id,
            action: 'deleted',
            entityType: 'location',
            entityId: id,
            entityName,
          })
        } catch (error) {
          console.warn('No pudimos registrar activity_log para delete de location.', error)
        }
      } else {
        console.warn(
          'No se registró activity_log para delete de location porque falta actorProfileId.',
        )
      }

      await deleteLocation(id)
      navigate(routePaths.locations)
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos eliminar la locación.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const primaryCardActions =
    id && !isLoading && !errorMessage ? (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={getLocationEditPath(id)}
          aria-label="Editar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        >
          <EditIcon />
        </Link>
        <button
          type="button"
          aria-label={isDeleting ? 'Eliminando...' : 'Eliminar'}
          onClick={() => void handleDeleteLocation()}
          disabled={isDeleting}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <DeleteIcon />
        </button>
      </div>
    ) : undefined

  if (!id) {
    return (
      <PageContainer
        title="Detalle de locación"
        description="Visualizá la información principal de la locación con la misma estructura visual del formulario."
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
      description={
        pageDescription ??
        'Visualizá la información principal de la locación con la misma estructura visual del formulario.'
      }
      hideHeader
    >
      <LocationDeleteProgressModal isOpen={isDeleting} />

      <Card className="border-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.10),_transparent_24%),linear-gradient(180deg,_#111111_0%,_#151515_52%,_#1a1a1a_100%)] p-6 shadow-none backdrop-blur-0">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando locación...</p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && deleteErrorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {deleteErrorMessage}
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
            mode={'view' satisfies LocationFormMode}
            locationId={id}
            initialValues={initialValues}
            primaryCardActions={primaryCardActions}
            showImagesSection
            showAdvancedSection={false}
          />
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default LocationViewPage
