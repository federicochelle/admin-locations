import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import {
  createCategory,
  getCategoryFormOptions,
  updateCategory,
} from './categories.service'
import type {
  CategoryCreatePayload,
  CategoryFormValues,
  CategoryUpdatePayload,
} from './categories.types'

export type CategoryFormMode = 'create' | 'edit'

type CategoryFormProps = {
  mode?: CategoryFormMode
  initialValues?: CategoryFormValues
  categoryId?: string
}

const defaultInitialValues: CategoryFormValues = {
  name: '',
  slug: '',
  parent_id: '',
  sort_order: '0',
  active: true,
}

function slugifyCategoryName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPayload(
  values: CategoryFormValues,
): CategoryCreatePayload | CategoryUpdatePayload {
  const parsedSortOrder = Number.parseInt(values.sort_order, 10)
  const trimmedName = values.name.trim()
  const generatedSlug = slugifyCategoryName(trimmedName)

  return {
    name: trimmedName,
    slug: values.slug.trim() || generatedSlug || 'categoria',
    parent_id: values.parent_id || null,
    sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
    active: values.active,
  }
}

function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: string
  htmlFor: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
      {children}
      {required ? <span className="text-slate-500"> *</span> : null}
    </label>
  )
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function CategoryForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  categoryId,
}: CategoryFormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState<CategoryFormValues>(initialValues)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function loadFormOptions() {
    try {
      setIsOptionsLoading(true)
      setOptionsError(null)

      await getCategoryFormOptions()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las opciones del formulario.'

      setOptionsError(message)
    } finally {
      setIsOptionsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getCategoryFormOptions()
      .then(() => {
        if (!isActive) {
          return
        }

        setOptionsError(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las opciones del formulario.'

        setOptionsError(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsOptionsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  function handleTextChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target

    setValues((currentValues) => {
      if (name === 'name') {
        return {
          ...currentValues,
          name: value,
          slug:
            mode === 'create'
              ? slugifyCategoryName(value)
              : currentValues.slug || slugifyCategoryName(value),
        }
      }

      return {
        ...currentValues,
        [name]: value,
      }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const payload = buildPayload(values)

      if (mode === 'edit') {
        if (!categoryId) {
          throw new Error('Falta el identificador de la categoría a editar.')
        }

        await updateCategory(categoryId, payload)
      } else {
        await createCategory(payload)
      }

      navigate(routePaths.categories)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'No pudimos guardar los cambios de la categoría.'
            : 'No pudimos guardar la categoría.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isOptionsLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <p className="text-sm text-slate-600">
          Cargando opciones del formulario...
        </p>
      </div>
    )
  }

  if (optionsError) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            No pudimos cargar el formulario
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{optionsError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => void loadFormOptions()}>
            Reintentar
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.categories)}
          >
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Datos principales</h2>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.categories)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'edit'
                ? 'Guardando cambios...'
                : 'Guardando...'
              : mode === 'edit'
                ? 'Guardar cambios'
                : 'Guardar categoría'}
          </Button>
        </div>
      </div>

      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="max-w-xl">
        <FieldLabel htmlFor="name" required>
          Nombre
        </FieldLabel>
        <input
          id="name"
          name="name"
          className={inputClassName()}
          value={values.name}
          onChange={handleTextChange}
          required
        />
      </div>
    </form>
  )
}

export default CategoryForm
