import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { getCategoryEditPath, routePaths } from '../../app/router/route-paths'
import {
  createCategory,
  getCategoryFormOptions,
  updateCategory,
} from './categories.service'
import {
  deleteCategoryImage,
  uploadCategoryImage,
} from './category-images.service'
import useAuth from '../auth/useAuth'
import { prepareImageUploadFile } from '../images/image-upload.processor'
import LocationImageUploader from '../locations/LocationImageUploader'
import {
  LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
} from '../locations/location-top-stack.styles'
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
  initialSubmitError?: string | null
}

const defaultInitialValues: CategoryFormValues = {
  name: '',
  slug: '',
  parent_id: '',
  sort_order: '0',
  active: true,
  image_url: null,
  image_cloudflare_id: null,
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

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function CategoryForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  categoryId,
  initialSubmitError = null,
}: CategoryFormProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [values, setValues] = useState<CategoryFormValues>(initialValues)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(initialSubmitError)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [persistedImageUrl, setPersistedImageUrl] = useState<string | null>(
    initialValues.image_url ?? null,
  )
  const [persistedImageCloudflareId, setPersistedImageCloudflareId] = useState<string | null>(
    initialValues.image_cloudflare_id ?? null,
  )
  const [shouldRemovePersistedImage, setShouldRemovePersistedImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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

  async function handleImageFilesSelected(files: FileList | null) {
    const file = files?.[0] ?? null

    if (!file) {
      return
    }

    try {
      setImageError(null)
      const nextFile = (await prepareImageUploadFile(file)).file

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      setSelectedImageFile(nextFile)
      setPreviewUrl(URL.createObjectURL(nextFile))
      setShouldRemovePersistedImage(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos procesar la imagen seleccionada.'

      setImageError(message)
    }
  }

  function handleRemoveImage() {
    setImageError(null)

    if (selectedImageFile || previewUrl) {
      setSelectedImageFile(null)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      setPreviewUrl(null)
      return
    }

    if (persistedImageUrl) {
      setShouldRemovePersistedImage(true)
    }
  }

  const visibleImageUrl =
    previewUrl ?? (shouldRemovePersistedImage ? null : persistedImageUrl)

  const hasAnyVisibleImage = Boolean(visibleImageUrl)

  async function syncCategoryImage(nextCategoryId: string) {
    if (selectedImageFile) {
      const uploadResult = await uploadCategoryImage({
        categoryId: nextCategoryId,
        file: selectedImageFile,
      })

      setPersistedImageUrl(uploadResult.finalizedImage.imageUrl)
      setPersistedImageCloudflareId(uploadResult.finalizedImage.imageCloudflareId)
      setShouldRemovePersistedImage(false)
      setSelectedImageFile(null)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      setPreviewUrl(null)
      setImageError(null)
      return
    }

    if (shouldRemovePersistedImage && persistedImageCloudflareId) {
      await deleteCategoryImage({
        categoryId: nextCategoryId,
      })

      setPersistedImageUrl(null)
      setPersistedImageCloudflareId(null)
      setShouldRemovePersistedImage(false)
      setImageError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      setImageError(null)

      const payload = buildPayload(values)

      if (mode === 'edit') {
        if (!categoryId) {
          throw new Error('Falta el identificador de la categoría a editar.')
        }

        await updateCategory(categoryId, payload, {
          actorProfileId: profile?.id ?? null,
        })

        await syncCategoryImage(categoryId)
      } else {
        const createdCategoryId = await createCategory(payload, {
          actorProfileId: profile?.id ?? null,
        })

        try {
          await syncCategoryImage(createdCategoryId)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'La categoría fue creada, pero no pudimos subir la imagen.'

          navigate(getCategoryEditPath(createdCategoryId), {
            state: {
              submitErrorMessage:
                `La categoría fue creada correctamente, pero la imagen no se pudo completar. ${message}`,
            },
          })
          return
        }
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
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

        <section className="space-y-4">
          {imageError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {imageError}
            </div>
          ) : null}

          {hasAnyVisibleImage ? (
            <div
              className={[
                'group relative overflow-hidden',
                LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
              ].join(' ')}
            >
            <img
              src={visibleImageUrl ?? undefined}
              alt="Vista previa de la imagen representativa"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20">
                <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 opacity-0 transition duration-200 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 text-xs font-medium text-red-600 shadow-sm backdrop-blur transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <LocationImageUploader
              disabled={isSubmitting}
              label="Seleccionar imagen"
              multiple={false}
              variant="empty-state"
              onFilesSelected={(files) => void handleImageFilesSelected(files)}
            />
          )}

          {shouldRemovePersistedImage && !previewUrl ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              La imagen actual se eliminará cuando guardes la categoría.
            </div>
          ) : null}
        </section>
      </div>
    </form>
  )
}

export default CategoryForm
