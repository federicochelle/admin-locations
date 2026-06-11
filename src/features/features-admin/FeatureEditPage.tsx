import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import FeatureForm, { type FeatureFormMode } from './FeatureForm'
import { getFeatureById } from './features.service'
import type { FeatureEditableRecord, FeatureFormValues } from './features.types'

function mapRecordToFormValues(record: FeatureEditableRecord): FeatureFormValues {
  return {
    name: record.name,
    slug: record.slug,
    group: record.group ?? '',
    type: record.type ?? 'boolean',
    active: record.active ?? true,
  }
}

function FeatureEditPage() {
  const { id } = useParams<{ id: string }>()
  const [initialValues, setInitialValues] = useState<FeatureFormValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    if (!id) {
      return
    }

    void getFeatureById(id)
      .then((record) => {
        if (!isActive) {
          return
        }

        setInitialValues(mapRecordToFormValues(record))
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar la feature.'

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

  if (!id) {
    return (
      <PageContainer
        title="Editar feature"
        description="Actualizá la información principal de la feature reutilizando el formulario base del panel."
      >
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar la feature
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No encontramos el identificador de la feature.
            </p>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Editar feature"
      description="Actualizá la información principal de la feature reutilizando el formulario base del panel."
    >
      <Card>
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando feature...</p>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar la feature
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && initialValues && id ? (
          <FeatureForm
            mode={'edit' satisfies FeatureFormMode}
            featureId={id}
            initialValues={initialValues}
          />
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default FeatureEditPage
