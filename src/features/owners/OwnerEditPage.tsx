import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import OwnerForm, { type OwnerFormMode } from './OwnerForm'
import { deleteLocation } from '../locations/locations.service'
import LocationDeleteProgressModal from '../locations/LocationDeleteProgressModal'
import { getOwnerById } from './owners.service'
import type {
  OwnerEditableDetails,
  OwnerEditableRecord,
  OwnerFormValues,
  OwnerLocationListItem,
} from './owners.types'

function formatLocationIdentifier(location: Pick<OwnerLocationListItem, 'locationCode' | 'title'>) {
  const locationCode = location.locationCode?.trim()

  if (locationCode) {
    return locationCode.replaceAll('-', ' ')
  }

  const title = location.title.trim()

  return title.length > 0 ? title : 'esta locación'
}

function mapRecordToFormValues(record: OwnerEditableRecord): OwnerFormValues {
  return {
    full_name: record.full_name,
    company_name: record.company_name ?? '',
    email: record.email ?? '',
    phone: record.phone ?? '',
    whatsapp: record.whatsapp ?? '',
    document_or_rut: record.document_or_rut ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'active',
  }
}

function isMissingOwnerError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLocaleLowerCase()

  return (
    error.message === 'OWNER_NOT_FOUND' ||
    normalizedMessage.includes('cannot coerce the result to a single json object') ||
    normalizedMessage.includes('no rows returned') ||
    normalizedMessage.includes('not found')
  )
}

function OwnerEditPage() {
  const { id } = useParams<{ id: string }>()
  const [initialValues, setInitialValues] = useState<OwnerFormValues | null>(null)
  const [ownerLocations, setOwnerLocations] = useState<OwnerLocationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [activeLocationActionKey, setActiveLocationActionKey] = useState<string | null>(
    null,
  )
  const [locationActionErrorMessage, setLocationActionErrorMessage] = useState<
    string | null
  >(null)

  useEffect(() => {
    let isActive = true

    if (!id) {
      return
    }

    void getOwnerById(id)
      .then((details: OwnerEditableDetails) => {
        if (!isActive) {
          return
        }

        setInitialValues(mapRecordToFormValues(details.owner))
        setOwnerName(details.owner.full_name)
        setOwnerLocations(details.locations)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        console.error('No pudimos cargar el dueño en OwnerEditPage.', error)

        const message =
          isMissingOwnerError(error)
            ? 'OWNER_NOT_FOUND'
            : 'No pudimos cargar el dueño.'

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

  async function handleDeleteLocation(locationId: string) {
    const locationToDelete =
      ownerLocations.find((location) => location.id === locationId) ?? null

    if (
      !window.confirm(
        `¿Seguro que querés eliminar la locación "${locationToDelete ? formatLocationIdentifier(locationToDelete) : 'esta locación'}"?\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      return
    }

    try {
      setActiveLocationActionKey(`delete:${locationId}`)
      setLocationActionErrorMessage(null)
      await deleteLocation(locationId)
      setOwnerLocations((currentLocations) =>
        currentLocations.filter((location) => location.id !== locationId),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos eliminar la locación.'

      setLocationActionErrorMessage(message)
    } finally {
      setActiveLocationActionKey(null)
    }
  }

  const breadcrumbCurrentLabel = !id
    ? 'Editar dueño'
    : isLoading
      ? 'Cargando...'
      : !errorMessage && ownerName
        ? ownerName
        : 'Editar dueño'
  const pageTitle =
    id && !isLoading && !errorMessage && ownerName ? ownerName : 'Editar dueño'
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Listado de dueños', to: routePaths.owners },
        { label: breadcrumbCurrentLabel },
      ],
      title: pageTitle,
    }),
    [breadcrumbCurrentLabel, pageTitle],
  )

  useLayoutHeader(headerConfig)

  if (!id) {
    return (
      <PageContainer title="Editar dueño" description="" hideHeader>
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar el dueño
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No encontramos el identificador del dueño.
            </p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer title={pageTitle} description="" hideHeader>
      <LocationDeleteProgressModal
        isOpen={activeLocationActionKey?.startsWith('delete:') ?? false}
      />

      <Card>
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando dueño...</p>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {errorMessage === 'OWNER_NOT_FOUND'
                ? 'Dueño no encontrado'
                : 'No pudimos cargar el dueño'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorMessage === 'OWNER_NOT_FOUND'
                ? 'El dueño que intentás visualizar no existe o fue eliminado.'
                : errorMessage}
            </p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && initialValues ? (
          <>
            {locationActionErrorMessage ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {locationActionErrorMessage}
              </div>
            ) : null}

            <OwnerForm
              mode={'edit' satisfies OwnerFormMode}
              ownerId={id}
              ownerName={ownerName}
              initialValues={initialValues}
              locations={ownerLocations}
              activeLocationActionKey={activeLocationActionKey}
              onDeleteLocation={handleDeleteLocation}
            />
          </>
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default OwnerEditPage
