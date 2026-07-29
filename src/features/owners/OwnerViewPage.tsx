import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import {
  getOwnerEditPath,
  routePaths,
} from '../../app/router/route-paths'
import { buttonBaseClassName, buttonVariantClasses } from '../../components/ui/button.styles'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import { createActivityLog } from '../activity/activity-logs.service'
import useAuth from '../auth/useAuth'
import OwnerForm, { type OwnerFormMode } from './OwnerForm'
import { deleteOwner, getOwnerById } from './owners.service'
import type {
  OwnerEditableDetails,
  OwnerEditableRecord,
  OwnerFormValues,
  OwnerLocationListItem,
} from './owners.types'

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

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
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

function OwnerViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [initialValues, setInitialValues] = useState<OwnerFormValues | null>(null)
  const [ownerLocations, setOwnerLocations] = useState<OwnerLocationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

        console.error('No pudimos cargar el dueño en OwnerViewPage.', error)

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

  async function handleDeleteOwner() {
    if (!id || !ownerName) {
      return
    }

    if (ownerLocations.length > 0) {
      const shouldDelete = window.confirm(
        `¿Estás seguro de querer borrar este dueño?\n\nVas a dejar ${ownerLocations.length === 1 ? 'una locación sin dueño' : `${ownerLocations.length} locaciones sin dueño`}.`,
      )

      if (!shouldDelete) {
        return
      }
    }

    try {
      setIsDeleting(true)
      setDeleteErrorMessage(null)

      if (profile?.id) {
        try {
          await createActivityLog({
            actorProfileId: profile.id,
            action: 'deleted',
            entityType: 'owner',
            entityId: id,
            entityName: ownerName.trim() || 'Sin nombre',
          })
        } catch (error) {
          console.warn('No pudimos registrar activity_log de eliminación para owner.', error)
        }
      } else {
        console.warn('No se registró activity_log de eliminación para owner porque falta actorProfileId.')
      }

      await deleteOwner(id)
      navigate(routePaths.owners)
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error ? error.message : 'No pudimos eliminar el dueño.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const breadcrumbCurrentLabel = !id
    ? 'Detalle de dueño'
    : isLoading
      ? 'Cargando...'
      : !errorMessage && ownerName
        ? ownerName
        : 'Detalle de dueño'
  const pageTitle =
    id && !isLoading && !errorMessage && ownerName ? ownerName : 'Detalle de dueño'

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
      <PageContainer title="Detalle de dueño" description="" hideHeader>
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
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link
                to={getOwnerEditPath(id)}
                className={[buttonBaseClassName, buttonVariantClasses.secondary, 'gap-2'].join(' ')}
              >
                <EditIcon />
                Editar
              </Link>
              <Button
                className="border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 focus-visible:ring-4 focus-visible:ring-red-100"
                onClick={() => void handleDeleteOwner()}
                disabled={isDeleting}
              >
                <span className="inline-flex items-center gap-2">
                  <DeleteIcon />
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </span>
              </Button>
            </div>

            {deleteErrorMessage ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteErrorMessage}
              </div>
            ) : null}

            <OwnerForm
              mode={'view' satisfies OwnerFormMode}
              ownerId={id}
              ownerName={ownerName}
              initialValues={initialValues}
              locations={ownerLocations}
            />
          </>
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default OwnerViewPage
