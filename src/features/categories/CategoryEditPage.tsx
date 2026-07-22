import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import CategoryForm, { type CategoryFormMode } from './CategoryForm'
import { getCategoryById } from './categories.service'
import type {
  CategoryEditableRecord,
  CategoryFormValues,
} from './categories.types'

function mapRecordToFormValues(record: CategoryEditableRecord): CategoryFormValues {
  return {
    name: record.name,
    slug: record.slug,
    parent_id: record.parent_id ?? '',
    sort_order: String(record.sort_order ?? 0),
    active: record.active ?? true,
    image_url: record.image_url,
    image_cloudflare_id: record.image_cloudflare_id,
  }
}

type CategoryEditLocationState = {
  submitErrorMessage?: string
}

function isMissingCategoryError(error: unknown) {
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

function CategoryEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formId = 'category-edit-form'
  const [initialValues, setInitialValues] = useState<CategoryFormValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const initialSubmitError =
    typeof (location.state as CategoryEditLocationState | null)?.submitErrorMessage ===
    'string'
      ? (location.state as CategoryEditLocationState).submitErrorMessage ?? null
      : null

  useEffect(() => {
    let isActive = true

    if (!id) {
      return
    }

    void getCategoryById(id)
      .then((record) => {
        if (!isActive) {
          return
        }

        setInitialValues(mapRecordToFormValues(record))
        setCategoryName(record.name)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        console.error('No pudimos cargar la categoría en CategoryEditPage.', error)

        const message =
          isMissingCategoryError(error)
            ? 'CATEGORY_NOT_FOUND'
            : 'No pudimos cargar la categoría.'

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
    ? 'Editar categoría'
    : isLoading
      ? 'Cargando...'
      : !errorMessage && categoryName
        ? categoryName
        : 'Editar categoría'
  const pageTitle =
    id && !isLoading && !errorMessage && categoryName
      ? categoryName
      : 'Editar categoría'
  const pageDescription =
    id && !isLoading && !errorMessage && categoryName
      ? 'Editá la información principal de esta categoría.'
      : undefined
  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Listado de categorías', to: routePaths.categories },
        { label: breadcrumbCurrentLabel },
      ],
      title: pageTitle,
      description: pageDescription,
    }),
    [breadcrumbCurrentLabel, pageDescription, pageTitle],
  )

  useLayoutHeader(headerConfig)

  if (!id) {
    return (
      <PageContainer
        title="Editar categoría"
        description="Actualizá la información principal de la categoría reutilizando el formulario base del panel."
        hideHeader
      >
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              No pudimos cargar la categoría
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No encontramos el identificador de la categoría.
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
        'Actualizá la información principal de la categoría reutilizando el formulario base del panel.'
      }
      hideHeader
    >
      <Card className="-mx-3 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando categoría...</p>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {errorMessage === 'CATEGORY_NOT_FOUND'
                ? 'Categoría no encontrada'
                : 'No pudimos cargar la categoría'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorMessage === 'CATEGORY_NOT_FOUND'
                ? 'La categoría que intentás visualizar no existe o fue eliminada.'
                : errorMessage}
            </p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && initialValues && id ? (
          <CategoryForm
            formId={formId}
            mode={'edit' satisfies CategoryFormMode}
            categoryId={id}
            initialValues={initialValues}
            initialSubmitError={initialSubmitError}
            onSubmittingChange={setIsSubmitting}
          />
        ) : null}
      </Card>
      {!isLoading && !errorMessage && initialValues && id ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="sm:order-2"
          >
            {isSubmitting ? 'Guardando cambios...' : 'Guardar cambios'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.categories)}
            disabled={isSubmitting}
            className="sm:order-1"
          >
            Cancelar
          </Button>
        </div>
      ) : null}
    </PageContainer>
  )
}

export default CategoryEditPage
