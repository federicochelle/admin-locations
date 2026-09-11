import type { AdminErrorContext } from '../../../lib/admin-error-reporting'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
  PendingLocationImageStatus,
  UploadLocationImageInput,
  UploadLocationImageResult,
} from '../location-images.types'
import type {
  LocationSaveProgressState,
  LocationSaveStageKey,
  LocationSaveStageStatus,
} from '../LocationSaveProgressModal'
import { buildLocationImageUploadPlan } from './location-image-upload-plan'

type RunPendingLocationImageUploadsMode = 'create' | 'edit' | 'view'

type RunPendingLocationImageUploadsInput = {
  imageUploadConcurrency: number
  imageUploadTimeoutErrorMessage: string
  imageUploadTimeoutMs: number
  locationId: string
  mode: RunPendingLocationImageUploadsMode
  observation: AdminErrorContext
  pendingImages: PendingLocationImageFile[]
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  setSaveProgressError: (
    key: LocationSaveStageKey,
    message: string,
  ) => void
  timers: {
    clearTimeout: (timeoutId: number) => void
    setTimeout: (callback: () => void, timeoutMs: number) => number
  }
  updatePendingImage: (
    imageId: string,
    updates: Partial<PendingLocationImageFile>,
  ) => void
  updateSaveProgress: (
    updater: (currentState: LocationSaveProgressState) => LocationSaveProgressState,
  ) => void
  updateStageStatus: (
    key: LocationSaveStageKey,
    status: LocationSaveStageStatus,
  ) => void
  uploadLocationImage: (
    input: UploadLocationImageInput,
  ) => Promise<UploadLocationImageResult>
  visiblePersistedImages: LocationImageRecord[]
}

export async function runPendingLocationImageUploads({
  imageUploadConcurrency,
  imageUploadTimeoutErrorMessage,
  imageUploadTimeoutMs,
  locationId,
  mode,
  observation,
  pendingImages,
  reportLocationFailure,
  setSaveProgressError,
  timers,
  updatePendingImage,
  updateSaveProgress,
  updateStageStatus,
  uploadLocationImage,
  visiblePersistedImages,
}: RunPendingLocationImageUploadsInput) {
  if (pendingImages.length === 0) {
    updateStageStatus('uploadImages', 'skipped')
    return null
  }

  let hasImageErrors = false
  const uploadPlan = buildLocationImageUploadPlan({
    mode,
    pendingImages,
    visiblePersistedImages,
  })
  const { uploads } = uploadPlan

  if (uploadPlan.invalidPendingImages.length > 0) {
    throw new Error('Hay imágenes que no se pudieron procesar. Quitalas o volvé a cargarlas antes de guardar.')
  }

  if (uploads.length === 0) {
    updateStageStatus('uploadImages', 'skipped')
    return null
  }
  const activeUploadStatuses = new Map<
    string,
    Extract<PendingLocationImageStatus, 'uploading' | 'finalizing'>
  >()
  let completedUploads = 0
  let nextUploadIndex = 0

  function syncUploadProgress() {
    const activeUploadStatusesList = Array.from(activeUploadStatuses.values())
    const uploadingCurrentStep =
      activeUploadStatusesList.length === 0
        ? null
        : activeUploadStatusesList.includes('finalizing')
          ? 'finalizing'
          : 'uploading'

    updateSaveProgress((currentState) => ({
      ...currentState,
      uploadingDone: completedUploads,
      uploadingCurrentIndex:
        activeUploadStatusesList.length > 0
          ? Math.min(completedUploads + 1, currentState.uploadingTotal)
          : null,
      uploadingCurrentName: null,
      uploadingCurrentStep,
    }))
  }

  async function processUpload(
    image: PendingLocationImageFile,
    sortOrder: number,
  ) {
    const controller = new AbortController()
    let uploadTimeoutId: number | null = null

    try {
      updatePendingImage(image.id, {
        errorMessage: null,
        status: 'uploading',
      })

      activeUploadStatuses.set(image.id, 'uploading')
      syncUploadProgress()

      const uploadTask = uploadLocationImage({
        clientUploadId: image.id,
        correlationId: observation.correlationId,
        file: image.file,
        height: image.height,
        isCover: image.isCover,
        locationId,
        sortOrder,
        width: image.width,
        signal: controller.signal,
        onStatusChange: (status) => {
          updatePendingImage(image.id, {
            status,
          })

          activeUploadStatuses.set(image.id, status)
          syncUploadProgress()
        },
      })
      uploadTimeoutId = timers.setTimeout(() => {
        controller.abort(new Error(imageUploadTimeoutErrorMessage))
      }, imageUploadTimeoutMs)

      await uploadTask

      updatePendingImage(image.id, {
        errorMessage: null,
        status: 'done',
      })
    } catch (error) {
      hasImageErrors = true
      reportLocationFailure(error, { ...observation, resourceType: 'image', resourceId: locationId, stage: 'images.upload', outcome: 'partial', extraSafeContext: { ...observation.extraSafeContext, image_count: uploads.length, image_index: image.originalIndex, image_mime: image.file.type, image_bytes: image.file.size, image_dimensions: { width: image.width, height: image.height }, timeout_ms: imageUploadTimeoutMs } })

      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos subir esta imagen.'

      if (message === imageUploadTimeoutErrorMessage) {
        console.warn('[UPLOAD TIMEOUT]', image.id)
      } else {
        console.error('[UPLOAD ERROR]', image.id, error)
      }

      updatePendingImage(image.id, {
        errorMessage: message,
        status: 'error',
      })
    } finally {
      if (uploadTimeoutId !== null) {
        timers.clearTimeout(uploadTimeoutId)
      }

      activeUploadStatuses.delete(image.id)
      completedUploads += 1
      syncUploadProgress()
    }
  }

  async function runUploadWorker() {
    while (nextUploadIndex < uploads.length) {
      const currentUploadIndex = nextUploadIndex
      nextUploadIndex += 1

      const currentUpload = uploads[currentUploadIndex]

      if (!currentUpload) {
        return
      }

      await processUpload(currentUpload.image, currentUpload.sortOrder)
    }
  }

  updateStageStatus('uploadImages', 'active')
  syncUploadProgress()

  const workerCount = Math.min(imageUploadConcurrency, uploads.length)

  await Promise.all(
    Array.from({ length: workerCount }, () => runUploadWorker()),
  )

  if (hasImageErrors) {
    const message =
      mode === 'edit'
        ? 'Los cambios de la locacion fueron guardados, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.'
        : 'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.'

    setSaveProgressError('uploadImages', message)
    return message
  }

  updateStageStatus('uploadImages', 'done')
  return null
}
