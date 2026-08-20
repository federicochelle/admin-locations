import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SaveProgressModal, {
  type SaveProgressModalAction,
} from '../../components/ui/SaveProgressModal'
import { routePaths } from '../../app/router/route-paths'
import {
  createCategory,
  getCategoryFormOptions,
  updateCategory,
} from './categories.service'
import {
  deleteCategoryImage,
  uploadCategoryImage,
} from './category-images.service'
import {
  normalizeCategoryLocationCodePrefixInput,
} from './location-code-prefix'
import useAuth from '../auth/useAuth'
import { prepareImageUploadFile } from '../images/image-upload.processor'
import { SUPPORTED_IMAGE_EXTENSIONS } from '../images/image-upload.constants'
import LocationImageUploader from '../locations/LocationImageUploader'
import type { LocationImageUploaderHandle } from '../locations/LocationImageUploader'
import LocationImageSourceModal from '../locations/LocationImageSourceModal'
import { downloadDropboxFiles } from '../locations/dropbox/dropbox-files'
import {
  getLoadedDropboxChooser,
  loadDropboxChooser,
} from '../locations/dropbox/dropbox-chooser'
import { LOCATION_TOP_STACK_PANEL_SURFACE_CLASS } from '../locations/location-top-stack.styles'
import type {
  CategoryCreatePayload,
  CategoryFormValues,
  CategoryUpdatePayload,
} from './categories.types'

export type CategoryFormMode = 'create' | 'edit'

type CategoryFormProps = {
  formId?: string
  mode?: CategoryFormMode
  initialValues?: CategoryFormValues
  categoryId?: string
  initialSubmitError?: string | null
  onBusyStateChange?: (state: {
    isProcessingImage: boolean
    isSubmitting: boolean
  }) => void
}

type CategorySaveStageKey =
  | 'category'
  | 'deleteImage'
  | 'uploadImage'
  | 'completed'

type CategorySaveStageStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'error'
  | 'skipped'

type CategorySaveState = {
  errorMessage: string | null
  stages: Array<{
    key: CategorySaveStageKey
    status: CategorySaveStageStatus
  }>
  successMessage: string | null
  uploadStep: 'preparing' | 'uploading' | 'finalizing' | null
}

type CategoryPendingImageStatus = 'processing' | 'pending' | 'error'

type CategoryPendingImageState = {
  file: File
  previewUrl: string
  status: CategoryPendingImageStatus
  errorMessage: string | null
}

const defaultInitialValues: CategoryFormValues = {
  name: '',
  slug: '',
  location_code_prefix: '',
  parent_id: '',
  sort_order: '0',
  active: true,
  image_url: null,
  image_cloudflare_id: null,
}

const SAVE_SUCCESS_DELAY_MS = 1000
const CATEGORY_IMAGE_PLACEHOLDER_PREVIEW_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

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
  const normalizedLocationCodePrefix = normalizeCategoryLocationCodePrefixInput(
    values.location_code_prefix,
  )

  if (normalizedLocationCodePrefix.length === 0) {
    throw new Error('El prefijo de código es obligatorio.')
  }

  return {
    name: trimmedName,
    slug: values.slug.trim() || generatedSlug || 'categoria',
    location_code_prefix: normalizedLocationCodePrefix,
    parent_id: values.parent_id || null,
    sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
    active: values.active,
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildCategorySaveState(input: {
  shouldDeleteImage: boolean
  shouldUploadImage: boolean
}): CategorySaveState {
  return {
    errorMessage: null,
    stages: [
      { key: 'category', status: 'pending' },
      {
        key: 'deleteImage',
        status: input.shouldDeleteImage ? 'pending' : 'skipped',
      },
      {
        key: 'uploadImage',
        status: input.shouldUploadImage ? 'pending' : 'skipped',
      },
      { key: 'completed', status: 'pending' },
    ],
    successMessage: null,
    uploadStep: null,
  }
}

function getCategorySaveStageStatus(
  state: CategorySaveState,
  key: CategorySaveStageKey,
) {
  return state.stages.find((stage) => stage.key === key)?.status ?? 'pending'
}

function getCategorySavePercentage(state: CategorySaveState) {
  if (state.successMessage) {
    return 100
  }

  let completedUnits = 0
  let totalUnits = 0
  const categoryStatus = getCategorySaveStageStatus(state, 'category')
  const deleteStatus = getCategorySaveStageStatus(state, 'deleteImage')
  const uploadStatus = getCategorySaveStageStatus(state, 'uploadImage')
  const completedStatus = getCategorySaveStageStatus(state, 'completed')

  totalUnits += 1
  completedUnits +=
    categoryStatus === 'done' || categoryStatus === 'skipped'
      ? 1
      : categoryStatus === 'active'
        ? 0.35
        : 0

  if (deleteStatus !== 'skipped') {
    totalUnits += 1
    completedUnits +=
      deleteStatus === 'done'
        ? 1
        : deleteStatus === 'active'
          ? 0.5
          : 0
  }

  if (uploadStatus !== 'skipped') {
    totalUnits += 1
    completedUnits +=
      uploadStatus === 'done'
        ? 1
        : uploadStatus === 'active'
          ? state.uploadStep === 'finalizing'
            ? 0.9
            : state.uploadStep === 'uploading'
              ? 0.65
              : 0.3
          : 0
  }

  totalUnits += 1
  completedUnits += completedStatus === 'done' ? 1 : 0

  return Math.max(0, Math.min(100, Math.round((completedUnits / totalUnits) * 100)))
}

function getCategorySaveMessage(state: CategorySaveState) {
  if (state.successMessage) {
    return state.successMessage
  }

  if (state.errorMessage) {
    return 'Guardado interrumpido'
  }

  if (getCategorySaveStageStatus(state, 'category') === 'active') {
    return 'Guardando categoría...'
  }

  if (getCategorySaveStageStatus(state, 'deleteImage') === 'active') {
    return 'Eliminando imagen...'
  }

  if (getCategorySaveStageStatus(state, 'uploadImage') === 'active') {
    if (state.uploadStep === 'uploading') {
      return 'Subiendo imagen...'
    }

    if (state.uploadStep === 'finalizing') {
      return 'Finalizando imagen...'
    }

    return 'Procesando imagen...'
  }

  if (getCategorySaveStageStatus(state, 'completed') === 'done') {
    return 'Cambios guardados correctamente'
  }

  return 'Preparando cambios...'
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

function ReplaceIcon() {
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
      <path d="M20 11a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v7h-7" />
    </svg>
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false
}

function revokePreviewUrl(previewUrl: string | null) {
  if (!previewUrl || !previewUrl.startsWith('blob:')) {
    return
  }

  URL.revokeObjectURL(previewUrl)
}

function ProcessingSpinner() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/15">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
    </span>
  )
}

function openCategoryDropboxChooser(dropbox: DropboxGlobal) {
  return new Promise<DropboxChooserFile[]>((resolve, reject) => {
    try {
      dropbox.choose({
        linkType: 'direct',
        multiselect: false,
        folderselect: false,
        extensions: [...SUPPORTED_IMAGE_EXTENSIONS],
        success(files) {
          resolve(files)
        },
        cancel() {
          resolve([])
        },
      })
    } catch (error) {
      reject(error)
    }
  })
}

function CategoryForm({
  formId = 'category-form',
  mode = 'create',
  initialValues = defaultInitialValues,
  categoryId,
  initialSubmitError = null,
  onBusyStateChange,
}: CategoryFormProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [values, setValues] = useState<CategoryFormValues>(initialValues)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(initialSubmitError)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingImage, setPendingImage] = useState<CategoryPendingImageState | null>(
    null,
  )
  const [persistedImageUrl, setPersistedImageUrl] = useState<string | null>(
    initialValues.image_url ?? null,
  )
  const [persistedImageCloudflareId, setPersistedImageCloudflareId] = useState<string | null>(
    initialValues.image_cloudflare_id ?? null,
  )
  const [shouldRemovePersistedImage, setShouldRemovePersistedImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false)
  const [isDropboxImporting, setIsDropboxImporting] = useState(false)
  const [, setDropboxImportProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
  const [saveProgress, setSaveProgress] = useState<CategorySaveState | null>(null)
  const imageUploaderRef = useRef<LocationImageUploaderHandle | null>(null)
  const dropboxAbortControllerRef = useRef<AbortController | null>(null)
  const isDropboxChooserLoadingRef = useRef(false)
  const isMountedRef = useRef(true)
  const pendingImageRef = useRef<CategoryPendingImageState | null>(null)
  const pendingImageSelectionIdRef = useRef(0)
  const retryCategoryIdRef = useRef<string | null>(mode === 'edit' ? categoryId ?? null : null)
  const isProcessingPendingImage = pendingImage?.status === 'processing'

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
    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Si falla la precarga, reintentamos cuando el usuario abra el modal o toque Dropbox.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    onBusyStateChange?.({
      isProcessingImage: isProcessingPendingImage,
      isSubmitting,
    })
  }, [isProcessingPendingImage, isSubmitting, onBusyStateChange])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      dropboxAbortControllerRef.current?.abort(
        new DOMException(
          'La importación desde Dropbox fue cancelada.',
          'AbortError',
        ),
      )
    }
  }, [])

  useEffect(() => {
    pendingImageRef.current = pendingImage
  }, [pendingImage])

  useEffect(() => {
    return () => {
      revokePreviewUrl(pendingImageRef.current?.previewUrl ?? null)
    }
  }, [])

  useEffect(() => {
    if (!isImageSourceModalOpen) {
      return
    }

    if (getLoadedDropboxChooser() || isDropboxChooserLoadingRef.current) {
      return
    }

    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Intentamos precargar el script para abrir el chooser desde el click del usuario.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isImageSourceModalOpen])

  function openSaveProgress() {
    setSaveProgress(
      buildCategorySaveState({
        shouldDeleteImage: shouldRemovePersistedImage && Boolean(persistedImageCloudflareId),
        shouldUploadImage: pendingImage?.status === 'pending',
      }),
    )
  }

  function updateCategorySaveProgress(
    updater: (currentState: CategorySaveState) => CategorySaveState,
  ) {
    setSaveProgress((currentState) => {
      if (!currentState) {
        return currentState
      }

      return updater(currentState)
    })
  }

  function updateSaveProgressStage(
    key: CategorySaveStageKey,
    status: CategorySaveStageStatus,
  ) {
    updateCategorySaveProgress((currentState) => ({
      ...currentState,
      stages: currentState.stages.map((stage) =>
        stage.key === key
          ? {
              ...stage,
              status,
            }
          : stage,
      ),
    }))
  }

  function setSaveProgressError(key: CategorySaveStageKey, message: string) {
    updateCategorySaveProgress((currentState) => ({
      ...currentState,
      errorMessage: message,
      stages: currentState.stages.map((stage) =>
        stage.key === key
          ? {
              ...stage,
              status: 'error',
            }
          : stage,
      ),
    }))
  }

  function markSaveProgressSuccess() {
    updateCategorySaveProgress((currentState) => ({
      ...currentState,
      successMessage: 'Cambios guardados correctamente',
    }))
  }

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

      if (name === 'location_code_prefix') {
        return {
          ...currentValues,
          location_code_prefix: normalizeCategoryLocationCodePrefixInput(value),
        }
      }

      return {
        ...currentValues,
        [name]: value,
      }
    })
  }

  async function handleSelectedCategoryImageFiles(files: File[]) {
    const file = files[0] ?? null

    if (!file) {
      return
    }

    const selectionId = pendingImageSelectionIdRef.current + 1
    pendingImageSelectionIdRef.current = selectionId

    try {
      setImageError(null)
      setPendingImage((currentImage) => {
        if (currentImage) {
          revokePreviewUrl(currentImage.previewUrl)
        }

        return {
          errorMessage: null,
          file,
          previewUrl: CATEGORY_IMAGE_PLACEHOLDER_PREVIEW_URL,
          status: 'processing',
        }
      })
      setShouldRemovePersistedImage(false)

      const nextFile = (await prepareImageUploadFile(file)).file
      const nextPreviewUrl = URL.createObjectURL(nextFile)

      if (
        !isMountedRef.current ||
        pendingImageSelectionIdRef.current !== selectionId
      ) {
        revokePreviewUrl(nextPreviewUrl)
        return
      }

      setPendingImage((currentImage) => {
        if (currentImage?.previewUrl && currentImage.previewUrl !== nextPreviewUrl) {
          revokePreviewUrl(currentImage.previewUrl)
        }

        return {
          errorMessage: null,
          file: nextFile,
          previewUrl: nextPreviewUrl,
          status: 'pending',
        }
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos procesar la imagen seleccionada.'

      if (
        !isMountedRef.current ||
        pendingImageSelectionIdRef.current !== selectionId
      ) {
        return
      }

      setPendingImage((currentImage) =>
        currentImage
          ? {
              ...currentImage,
              errorMessage: message,
              status: 'error',
            }
          : currentImage,
      )
      setImageError(message)
    }
  }

  async function handleImageFilesSelected(files: FileList | null) {
    await handleSelectedCategoryImageFiles(Array.from(files ?? []))
  }

  function handleOpenImageSourceModal() {
    if (isSubmitting || isDropboxImporting) {
      return
    }

    setIsImageSourceModalOpen(true)
  }

  function handleCloseImageSourceModal() {
    if (isDropboxImporting) {
      return
    }

    setIsImageSourceModalOpen(false)
  }

  function handleSelectDeviceSource() {
    if (isDropboxImporting) {
      return
    }

    setIsImageSourceModalOpen(false)

    window.setTimeout(() => {
      imageUploaderRef.current?.openFileDialog()
    }, 0)
  }

  async function continueDropboxImport(
    selectedFilesPromise: Promise<DropboxChooserFile[]>,
  ) {
    try {
      const selectedFiles = await selectedFilesPromise

      if (!isMountedRef.current || selectedFiles.length === 0) {
        return
      }

      const controller = new AbortController()
      dropboxAbortControllerRef.current = controller
      setIsDropboxImporting(true)
      setDropboxImportProgress({
        processed: 0,
        total: selectedFiles.length,
      })

      const { files, errors } = await downloadDropboxFiles(selectedFiles, {
        signal: controller.signal,
        onProgress: (processed, total) => {
          if (!isMountedRef.current) {
            return
          }

          setDropboxImportProgress({
            processed,
            total,
          })
        },
      })

      if (!isMountedRef.current) {
        return
      }

      if (files.length === 0) {
        setImageError(
          errors[0] ?? 'No pudimos importar la imagen desde Dropbox.',
        )
        return
      }

      await handleSelectedCategoryImageFiles(files)

      if (!isMountedRef.current) {
        return
      }

      if (errors.length > 0) {
        setImageError(errors[0] ?? null)
      }
    } catch (error) {
      if (!isMountedRef.current || isAbortError(error)) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos importar la imagen desde Dropbox.'

      setImageError(message)
    } finally {
      dropboxAbortControllerRef.current = null

      if (isMountedRef.current) {
        setIsDropboxImporting(false)
        setDropboxImportProgress(null)
      }
    }
  }

  function handleSelectDropboxSource() {
    if (isDropboxImporting) {
      return
    }

    dropboxAbortControllerRef.current?.abort(
      new DOMException(
        'La importación desde Dropbox fue cancelada.',
        'AbortError',
      ),
    )
    dropboxAbortControllerRef.current = null
    setImageError(null)

    const dropbox = getLoadedDropboxChooser()

    if (!dropbox) {
      setImageError('Preparando Dropbox... Intenta nuevamente en un momento.')

      if (!isDropboxChooserLoadingRef.current) {
        isDropboxChooserLoadingRef.current = true
        void loadDropboxChooser()
          .catch(() => {
            if (!isMountedRef.current) {
              return
            }

            setImageError('No pudimos cargar Dropbox Chooser. Intenta nuevamente.')
          })
          .finally(() => {
            if (!isMountedRef.current) {
              return
            }

            isDropboxChooserLoadingRef.current = false
          })
      }

      return
    }

    if (
      typeof dropbox.isBrowserSupported === 'function' &&
      !dropbox.isBrowserSupported()
    ) {
      setImageError('Dropbox no es compatible con este navegador.')
      return
    }

    const selectedFilesPromise = openCategoryDropboxChooser(dropbox)
    setIsImageSourceModalOpen(false)
    void continueDropboxImport(selectedFilesPromise)
  }

  function handleRemoveImage() {
    setImageError(null)
    pendingImageSelectionIdRef.current += 1

    if (pendingImage) {
      revokePreviewUrl(pendingImage.previewUrl)
      setPendingImage(null)
      return
    }

    if (persistedImageUrl) {
      setShouldRemovePersistedImage(true)
    }
  }

  const visibleImageUrl =
    pendingImage?.previewUrl ?? (shouldRemovePersistedImage ? null : persistedImageUrl)

  const hasAnyVisibleImage = Boolean(pendingImage || visibleImageUrl)

  async function syncCategoryImage(nextCategoryId: string) {
    if (pendingImage?.status === 'pending') {
      updateSaveProgressStage('uploadImage', 'active')

      const uploadResult = await uploadCategoryImage({
        categoryId: nextCategoryId,
        file: pendingImage.file,
        onStatusChange: (status) => {
          updateCategorySaveProgress((currentState) => ({
            ...currentState,
            uploadStep: status,
          }))
        },
      })

      setPersistedImageUrl(uploadResult.finalizedImage.imageUrl)
      setPersistedImageCloudflareId(uploadResult.finalizedImage.imageCloudflareId)
      setShouldRemovePersistedImage(false)
      revokePreviewUrl(pendingImage.previewUrl)
      setPendingImage(null)
      setImageError(null)
      updateCategorySaveProgress((currentState) => ({
        ...currentState,
        uploadStep: null,
      }))
      updateSaveProgressStage('uploadImage', 'done')
      return
    }

    if (shouldRemovePersistedImage && persistedImageCloudflareId) {
      updateSaveProgressStage('deleteImage', 'active')
      await deleteCategoryImage({
        categoryId: nextCategoryId,
      })

      setPersistedImageUrl(null)
      setPersistedImageCloudflareId(null)
      setShouldRemovePersistedImage(false)
      setImageError(null)
      updateSaveProgressStage('deleteImage', 'done')
    }
  }

  async function performSave() {
    let failedStage: CategorySaveStageKey = 'category'

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      setImageError(null)
      openSaveProgress()
      updateSaveProgressStage('category', 'active')

      const payload = buildPayload(values)
      let nextCategoryId = retryCategoryIdRef.current

      if (mode === 'edit') {
        if (!categoryId) {
          throw new Error('Falta el identificador de la categoría a editar.')
        }

        nextCategoryId = categoryId
      }

      if (nextCategoryId) {
        await updateCategory(nextCategoryId, payload, {
          actorProfileId: profile?.id ?? null,
        })
      } else {
        nextCategoryId = await createCategory(payload, {
          actorProfileId: profile?.id ?? null,
        })
        retryCategoryIdRef.current = nextCategoryId
      }

      updateSaveProgressStage('category', 'done')

      if (!nextCategoryId) {
        throw new Error('No pudimos determinar la categoría a guardar.')
      }

      if (shouldRemovePersistedImage && persistedImageCloudflareId) {
        failedStage = 'deleteImage'
      } else if (pendingImage?.status === 'pending') {
        failedStage = 'uploadImage'
      }

      await syncCategoryImage(nextCategoryId)

      updateSaveProgressStage('completed', 'done')
      markSaveProgressSuccess()
      await wait(SAVE_SUCCESS_DELAY_MS)
      navigate(routePaths.categories)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'No pudimos guardar los cambios de la categoría.'
            : 'No pudimos guardar la categoría.'

      setSubmitError(message)
      setSaveProgressError(failedStage, message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await performSave()
  }

  function handleCloseSaveProgress() {
    if (isSubmitting) {
      return
    }

    setSaveProgress(null)
  }

  const saveProgressActions: SaveProgressModalAction[] =
    saveProgress?.errorMessage && !isSubmitting
      ? [
          {
            label: 'Cerrar',
            onClick: handleCloseSaveProgress,
            variant: 'secondary',
          },
          {
            label: 'Reintentar',
            onClick: () => void performSave(),
            variant: 'primary',
          },
        ]
      : []

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
          <button
            type="button"
            onClick={() => void loadFormOptions()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <form id={formId} className="space-y-8" onSubmit={handleSubmit}>
      {saveProgress ? (
        <SaveProgressModal
          actions={saveProgressActions}
          errorMessage={saveProgress.errorMessage}
          message={getCategorySaveMessage(saveProgress)}
          percentage={getCategorySavePercentage(saveProgress)}
          title="Guardando cambios"
        />
      ) : null}

      <LocationImageSourceModal
        isDropboxImporting={isDropboxImporting}
        isOpen={isImageSourceModalOpen}
        onChooseDevice={handleSelectDeviceSource}
        onChooseDropbox={() => void handleSelectDropboxSource()}
        onClose={handleCloseImageSourceModal}
        target="cover"
        title="Agregar imagen"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Datos principales</h2>
        </div>
      </div>

      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="max-w-xl space-y-6">
          <div>
            <FieldLabel htmlFor="name" required>
              Nombre
            </FieldLabel>
            <input
              id="name"
              name="name"
              className={inputClassName()}
              value={values.name}
              onChange={handleTextChange}
              placeholder="Castillos"
              required
            />
          </div>

          <div>
            <FieldLabel htmlFor="location_code_prefix" required>
              Prefijo de código
            </FieldLabel>
            <input
              id="location_code_prefix"
              name="location_code_prefix"
              className={inputClassName()}
              value={values.location_code_prefix}
              onChange={handleTextChange}
              placeholder="Castillo"
              required
            />
          </div>
        </div>

        <section className="space-y-4">
          <div className="hidden">
            <LocationImageUploader
              ref={imageUploaderRef}
              disabled={isSubmitting || isDropboxImporting || isProcessingPendingImage}
              label="Seleccionar imagen"
              multiple={false}
              onFilesSelected={(files) => void handleImageFilesSelected(files)}
            />
          </div>

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
              {pendingImage?.status === 'processing' ? (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-center text-sm text-slate-500" />
              ) : (
                <img
                  src={visibleImageUrl ?? undefined}
                  alt="Vista previa de la imagen representativa"
                  className="h-full w-full object-cover"
                />
              )}
              {pendingImage &&
              (pendingImage.status === 'processing' || pendingImage.status === 'error') ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/45 px-5 text-center text-white backdrop-blur-[1px]">
                  {pendingImage.status === 'processing' ? <ProcessingSpinner /> : null}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {pendingImage.status === 'processing'
                        ? 'Procesando imagen...'
                        : pendingImage.status === 'error'
                          ? 'No se pudo procesar'
                          : ''}
                    </p>
                    <p className="line-clamp-2 text-xs text-white/80">
                      {pendingImage.file.name}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20">
                <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 opacity-0 transition duration-200 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={handleOpenImageSourceModal}
                    disabled={isSubmitting || isDropboxImporting || isProcessingPendingImage}
                    className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ReplaceIcon />
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isSubmitting || isDropboxImporting}
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
              ref={imageUploaderRef}
              disabled={isSubmitting || isDropboxImporting || isProcessingPendingImage}
              label="Seleccionar imagen"
              multiple={false}
              onTrigger={handleOpenImageSourceModal}
              variant="empty-state"
              onFilesSelected={(files) => void handleImageFilesSelected(files)}
            />
          )}

          {shouldRemovePersistedImage && !pendingImage?.previewUrl ? (
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
