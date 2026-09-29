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

const MAX_IMAGE_UPLOAD_ATTEMPTS = 3
const MAX_BACKGROUND_RECYCLES = 5
const BACKGROUND_RETRY_ERROR_MESSAGE =
  'La subida quedó pendiente al volver del segundo plano. Reintentando...'
const BACKGROUND_RECYCLE_LIMIT_ERROR_MESSAGE =
  'No pudimos reanudar la subida al volver a la app. Volve a intentar.'

type UploadVisibility = {
  addEventListener?: (
    type: 'visibilitychange',
    listener: () => void,
  ) => void
  removeEventListener?: (
    type: 'visibilitychange',
    listener: () => void,
  ) => void
  visibilityState?: string
}

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
  visibility?: UploadVisibility
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
  visibility,
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
  let isPageHidden = visibility?.visibilityState === 'hidden'
  const activeUploadAttempts = new Map<
    string,
    {
      backgrounded: boolean
      controller: AbortController
    }
  >()
  const visibleWaiters = new Set<() => void>()

  function waitUntilVisible() {
    if (!isPageHidden) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      visibleWaiters.add(resolve)
    })
  }

  function resolveVisibleWaiters() {
    const waiters = Array.from(visibleWaiters)
    visibleWaiters.clear()
    waiters.forEach((resolve) => resolve())
  }

  function handleVisibilityChange() {
    isPageHidden = visibility?.visibilityState === 'hidden'

    if (isPageHidden) {
      activeUploadAttempts.forEach((attempt) => {
        attempt.backgrounded = true
      })
      return
    }

    resolveVisibleWaiters()
    activeUploadAttempts.forEach((attempt) => {
      if (attempt.backgrounded && !attempt.controller.signal.aborted) {
        attempt.controller.abort(new Error(BACKGROUND_RETRY_ERROR_MESSAGE))
      }
    })
  }

  if (visibility?.addEventListener) {
    visibility.addEventListener('visibilitychange', handleVisibilityChange)
  }

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
    let backgroundRecycleCount = 0
    let lastError: unknown = null
    let networkAttempt = 1

    try {
      updatePendingImage(image.id, {
        errorMessage: null,
        status: 'uploading',
      })

      activeUploadStatuses.set(image.id, 'uploading')
      syncUploadProgress()

      while (networkAttempt <= MAX_IMAGE_UPLOAD_ATTEMPTS) {
        await waitUntilVisible()

        const controller = new AbortController()
        let uploadTimeoutId: number | null = null

        try {
          activeUploadAttempts.set(image.id, {
            backgrounded: isPageHidden,
            controller,
          })

          if (networkAttempt > 1 || backgroundRecycleCount > 0) {
            activeUploadStatuses.set(image.id, 'uploading')
            syncUploadProgress()
          }

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
          lastError = null
          break
        } catch (error) {
          lastError = error

          const message =
            error instanceof Error
              ? error.message
              : 'No pudimos subir esta imagen.'

          if (message === BACKGROUND_RETRY_ERROR_MESSAGE) {
            backgroundRecycleCount += 1

            if (backgroundRecycleCount > MAX_BACKGROUND_RECYCLES) {
              throw new Error(BACKGROUND_RECYCLE_LIMIT_ERROR_MESSAGE, {
                cause: error,
              })
            }

            console.warn('[UPLOAD BACKGROUND RETRY]', image.id, {
              backgroundRecycleCount,
              networkAttempt,
            })
            continue
          }

          if (networkAttempt >= MAX_IMAGE_UPLOAD_ATTEMPTS) {
            throw error
          }

          if (message === imageUploadTimeoutErrorMessage) {
            console.warn('[UPLOAD TIMEOUT]', image.id, {
              networkAttempt,
            })
          } else {
            console.error('[UPLOAD ERROR]', image.id, {
              error,
              networkAttempt,
            })
          }

          networkAttempt += 1
        } finally {
          if (uploadTimeoutId !== null) {
            timers.clearTimeout(uploadTimeoutId)
          }
          activeUploadAttempts.delete(image.id)
        }
      }

      if (lastError !== null) {
        throw lastError
      }

      updatePendingImage(image.id, {
        errorMessage: null,
        status: 'done',
      })
    } catch (error) {
      hasImageErrors = true
      reportLocationFailure(error, { ...observation, resourceType: 'image', resourceId: locationId, stage: 'images.upload', outcome: 'partial', extraSafeContext: { ...observation.extraSafeContext, attempt: networkAttempt, image_count: uploads.length, image_index: image.originalIndex, image_mime: image.file.type, image_bytes: image.file.size, image_dimensions: { width: image.width, height: image.height }, timeout_ms: imageUploadTimeoutMs } })

      const message =
        error instanceof Error
          ? error.message === BACKGROUND_RETRY_ERROR_MESSAGE
            ? 'No pudimos subir esta imagen.'
            : error.message
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
      activeUploadStatuses.delete(image.id)
      completedUploads += 1
      syncUploadProgress()
    }
  }

  async function runUploadWorker() {
    while (true) {
      if (nextUploadIndex >= uploads.length) {
        return
      }

      await waitUntilVisible()

      if (nextUploadIndex >= uploads.length) {
        return
      }

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

  try {
    await Promise.all(
      Array.from({ length: workerCount }, () => runUploadWorker()),
    )
  } finally {
    if (visibility?.removeEventListener) {
      visibility.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    resolveVisibleWaiters()
  }

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
