import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
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
  }
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
  const [initialValues, setInitialValues] = useState<CategoryFormValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState<string | null>(null)

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
      <Card>
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
            mode={'edit' satisfies CategoryFormMode}
            categoryId={id}
            initialValues={initialValues}
          />
        ) : null}
      </Card>
    </PageContainer>
  )
}

export default CategoryEditPage
