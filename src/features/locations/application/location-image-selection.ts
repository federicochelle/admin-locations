import type { PendingLocationImageFile } from '../location-images.types'
import {
  isExpectedAdminError,
  type AdminErrorContext,
} from '../../../lib/admin-error-reporting'
import { isAdminOperationTimeoutError, runWithAdminTimeout } from '../../../lib/async-timeout'
import { IMAGE_DECODE_ERROR_MESSAGE } from '../../images/decode-image'

type ImageSelectionTarget = 'cover' | 'gallery'

type ImageSelectionPlanInput = {
  files: File[]
  target: ImageSelectionTarget
}

type ImageSelectionPlan = {
  isCoverSelection: boolean
  selectedFiles: File[]
  totalFiles: number
}

type BuildPendingImagePlaceholderInputsInput = {
  isCoverSelection: boolean
  selectedFiles: File[]
  startingOriginalIndex: number
  target: ImageSelectionTarget
}

export type PendingImagePlaceholderInput = {
  file: File
  isCover: boolean
  originalIndex: number
  target: ImageSelectionTarget
}

type MergePendingImagePlaceholdersInput = {
  currentImages: PendingLocationImageFile[]
  isCoverSelection: boolean
  placeholders: PendingLocationImageFile[]
}

type MergePendingImagePlaceholdersResult = {
  nextImages: PendingLocationImageFile[]
  previewUrlsToRevoke: string[]
  removedImageIds: string[]
}

type LocationImageSelectionRef<T> = {
  current: T
}

type PrepareSelectedLocationImagesInput = {
  correlationId: string
  imagePreparationConcurrency: number
  imagePreparationTimeoutMs?: number
  isMountedRef: LocationImageSelectionRef<boolean>
  placeholders: PendingLocationImageFile[]
  prepareImage: (
    file: File,
    options: {
      id: string
      isCover: boolean
      originalIndex: number
      target: ImageSelectionTarget
      onStatusChange?: (statusLabel: string) => void
    },
  ) => Promise<PendingLocationImageFile>
  removedPendingImageIdsRef: LocationImageSelectionRef<Set<string>>
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  revokePreviewUrl: (previewUrl: string) => void
  setPendingImages: (
    updater: (
      currentImages: PendingLocationImageFile[],
    ) => PendingLocationImageFile[],
  ) => void
  setProcessedImagesCount: (count: number) => void
  target: ImageSelectionTarget
  totalFiles: number
}

type RetryPendingLocationImagePreparationInput = {
  correlationId: string
  imageId: string
  imagePreparationTimeoutMs?: number
  isMountedRef: LocationImageSelectionRef<boolean>
  pendingImagesRef: LocationImageSelectionRef<PendingLocationImageFile[]>
  prepareImage: PrepareSelectedLocationImagesInput['prepareImage']
  removedPendingImageIdsRef: LocationImageSelectionRef<Set<string>>
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  retryingPendingImageIdsRef: LocationImageSelectionRef<Set<string>>
  revokePreviewUrl: (previewUrl: string) => void
  setPendingImages: PrepareSelectedLocationImagesInput['setPendingImages']
}

type HandleSelectedLocationImageFilesInput = {
  createCorrelationId: () => string
  createPlaceholder: (
    file: File,
    options: {
      isCover: boolean
      originalIndex: number
      target: ImageSelectionTarget
    },
  ) => PendingLocationImageFile
  files: File[]
  getNextOriginalIndex: (currentImages: PendingLocationImageFile[]) => number
  imagePreparationConcurrency: number
  imagePreparationTimeoutMs?: number
  isMountedRef: LocationImageSelectionRef<boolean>
  isReadOnly: boolean
  pendingImagesRef: LocationImageSelectionRef<PendingLocationImageFile[]>
  prepareImage: PrepareSelectedLocationImagesInput['prepareImage']
  removedPendingImageIdsRef: LocationImageSelectionRef<Set<string>>
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  revokePreviewUrl: (previewUrl: string) => void
  setEditDeleteErrorMessage: (message: string | null) => void
  setImageSelectionTarget: (target: ImageSelectionTarget | null) => void
  setImageValidationErrors: (errors: string[]) => void
  setIsPreparingImages: (isPreparing: boolean) => void
  setPendingImages: PrepareSelectedLocationImagesInput['setPendingImages']
  setProcessedImagesCount: (count: number) => void
  setTotalImagesToProcess: (count: number) => void
  target: ImageSelectionTarget
}

const DEFAULT_IMAGE_PREPARATION_TIMEOUT_MS = 60_000

export function getImageSelectionPlan({
  files,
  target,
}: ImageSelectionPlanInput): ImageSelectionPlan {
  const isCoverSelection = target === 'cover'
  const selectedFiles = isCoverSelection ? files.slice(0, 1) : files

  return {
    isCoverSelection,
    selectedFiles,
    totalFiles: selectedFiles.length,
  }
}

export function buildPendingImagePlaceholderInputs({
  isCoverSelection,
  selectedFiles,
  startingOriginalIndex,
  target,
}: BuildPendingImagePlaceholderInputsInput): PendingImagePlaceholderInput[] {
  return selectedFiles.map((file, index) => ({
    file,
    isCover: isCoverSelection && index === 0,
    originalIndex: startingOriginalIndex + index,
    target,
  }))
}

export function mergePendingImagePlaceholders({
  currentImages,
  isCoverSelection,
  placeholders,
}: MergePendingImagePlaceholdersInput): MergePendingImagePlaceholdersResult {
  if (!isCoverSelection) {
    return {
      nextImages: [...currentImages, ...placeholders],
      previewUrlsToRevoke: [],
      removedImageIds: [],
    }
  }

  const nextImages: PendingLocationImageFile[] = []
  const previewUrlsToRevoke: string[] = []
  const removedImageIds: string[] = []

  currentImages.forEach((image) => {
    if (image.selectionTarget === 'cover' && image.isCover) {
      removedImageIds.push(image.id)
      previewUrlsToRevoke.push(image.previewUrl)
      return
    }

    nextImages.push({
      ...image,
      isCover: false,
    })
  })

  return {
    nextImages: [...nextImages, ...placeholders],
    previewUrlsToRevoke,
    removedImageIds,
  }
}

export function applyPreparedImageToPendingImages(
  currentImages: PendingLocationImageFile[],
  preparedImage: PendingLocationImageFile,
) {
  return currentImages.map((image) =>
    image.id === preparedImage.id
      ? {
          ...image,
          errorMessage: null,
          file: preparedImage.file,
          height: preparedImage.height,
          processingLabel: null,
          previewUrl: preparedImage.previewUrl,
          retryable: undefined,
          status: 'pending' as const,
          width: preparedImage.width,
        }
      : image,
  )
}

export function applyImagePreparationErrorToPendingImages(
  currentImages: PendingLocationImageFile[],
  imageId: string,
  message: string,
  retryable?: boolean,
) {
  return currentImages.map((image) =>
    image.id === imageId
      ? {
          ...image,
          errorMessage: message,
          processingLabel: null,
          retryable,
          status: 'error' as const,
        }
      : image,
  )
}

function getErrorCause(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined
}

function getAggregateErrors(error: unknown): unknown[] {
  if (error instanceof AggregateError) {
    return Array.from(error.errors)
  }

  const errors =
    typeof error === 'object' && error !== null && 'errors' in error
      ? (error as { errors?: unknown }).errors
      : undefined

  return Array.isArray(errors) ? errors : []
}

function hasStructuredTimeoutError(error: unknown): boolean {
  const pending: unknown[] = [error]
  const seen = new Set<unknown>()

  while (pending.length > 0) {
    const current = pending.shift()

    if (!current || seen.has(current)) {
      continue
    }

    seen.add(current)

    if (
      isAdminOperationTimeoutError(current) ||
      (typeof current === 'object' &&
        current !== null &&
        (current as { name?: unknown }).name === 'AdminOperationTimeoutError' &&
        typeof (current as { timeoutMs?: unknown }).timeoutMs === 'number')
    ) {
      return true
    }

    pending.push(getErrorCause(current), ...getAggregateErrors(current))
  }

  return false
}

function hasExpectedAdminError(error: unknown): boolean {
  const pending: unknown[] = [error]
  const seen = new Set<unknown>()

  while (pending.length > 0) {
    const current = pending.shift()

    if (!current || seen.has(current)) {
      continue
    }

    seen.add(current)

    if (isExpectedAdminError(current)) {
      return true
    }

    pending.push(getErrorCause(current), ...getAggregateErrors(current))
  }

  return false
}

function isConfirmedImageDecodeFailure(error: unknown): boolean {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : undefined
  const cause = getErrorCause(error)

  return (
    message === IMAGE_DECODE_ERROR_MESSAGE &&
    getAggregateErrors(cause).length > 0
  )
}

export function getImagePreparationRetryable(
  error: unknown,
): boolean | undefined {
  if (hasStructuredTimeoutError(error)) {
    return true
  }

  if (hasExpectedAdminError(error) || isConfirmedImageDecodeFailure(error)) {
    return false
  }

  return undefined
}

type RunPendingImagePreparationInput = {
  correlationId: string
  imagePreparationTimeoutMs: number
  isMountedRef: LocationImageSelectionRef<boolean>
  onProcessed?: () => void
  placeholder: PendingLocationImageFile
  prepareImage: PrepareSelectedLocationImagesInput['prepareImage']
  removedPendingImageIdsRef: LocationImageSelectionRef<Set<string>>
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  revokePreviousPreviewUrl?: (
    placeholder: PendingLocationImageFile,
    preparedImage: PendingLocationImageFile,
  ) => void
  revokePreviewUrl: (previewUrl: string) => void
  setPendingImages: PrepareSelectedLocationImagesInput['setPendingImages']
  target: ImageSelectionTarget
  totalFiles: number
}

async function runPendingImagePreparation({
  correlationId,
  imagePreparationTimeoutMs,
  isMountedRef,
  onProcessed,
  placeholder,
  prepareImage,
  removedPendingImageIdsRef,
  reportLocationFailure,
  revokePreviousPreviewUrl,
  revokePreviewUrl,
  setPendingImages,
  target,
  totalFiles,
}: RunPendingImagePreparationInput) {
  try {
    const preparedImage = await runWithAdminTimeout({
      action: () =>
        prepareImage(placeholder.file, {
          id: placeholder.id,
          isCover: placeholder.isCover,
          onStatusChange: (processingLabel) => {
            if (
              !isMountedRef.current ||
              removedPendingImageIdsRef.current.has(placeholder.id)
            ) {
              return
            }

            setPendingImages((currentImages) =>
              currentImages.map((image) =>
                image.id === placeholder.id
                  ? {
                      ...image,
                      processingLabel,
                    }
                  : image,
              ),
            )
          },
          originalIndex: placeholder.originalIndex,
          target,
        }),
      message: `${placeholder.file.name}: la preparación de la imagen demoró demasiado. Probá nuevamente.`,
      provider: 'browser',
      stage: 'images.prepare',
      timeoutMs: imagePreparationTimeoutMs,
    })

    if (
      !isMountedRef.current ||
      removedPendingImageIdsRef.current.has(preparedImage.id)
    ) {
      revokePreviewUrl(preparedImage.previewUrl)
      return
    }

    revokePreviousPreviewUrl?.(placeholder, preparedImage)
    setPendingImages((currentImages) =>
      applyPreparedImageToPendingImages(currentImages, preparedImage),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `${placeholder.file.name}: no pudimos optimizar la imagen seleccionada.`
    const retryable = getImagePreparationRetryable(error)

    if (
      isMountedRef.current &&
      !removedPendingImageIdsRef.current.has(placeholder.id)
    ) {
      reportLocationFailure(error, {
        operation: 'location.image.prepare',
        resourceType: 'image',
        stage: 'images.prepare',
        provider: 'browser',
        retryable,
        correlationId,
        extraSafeContext: {
          image_count: totalFiles,
          image_index: placeholder.originalIndex,
          image_mime: placeholder.file.type,
          image_bytes: placeholder.file.size,
          ...(retryable !== undefined ? { retryable } : {}),
          ...(isAdminOperationTimeoutError(error)
            ? { timeout_ms: error.timeoutMs }
            : {}),
        },
      })
    }

    if (
      !isMountedRef.current ||
      removedPendingImageIdsRef.current.has(placeholder.id)
    ) {
      return
    }

    setPendingImages((currentImages) =>
      applyImagePreparationErrorToPendingImages(
        currentImages,
        placeholder.id,
        message,
        retryable,
      ),
    )
  } finally {
    onProcessed?.()
  }
}

export async function retryPendingLocationImagePreparation({
  correlationId,
  imageId,
  imagePreparationTimeoutMs = DEFAULT_IMAGE_PREPARATION_TIMEOUT_MS,
  isMountedRef,
  pendingImagesRef,
  prepareImage,
  removedPendingImageIdsRef,
  reportLocationFailure,
  retryingPendingImageIdsRef,
  revokePreviewUrl,
  setPendingImages,
}: RetryPendingLocationImagePreparationInput) {
  if (retryingPendingImageIdsRef.current.has(imageId)) {
    return
  }

  const placeholder = pendingImagesRef.current.find(
    (image) => image.id === imageId,
  )

  if (
    !placeholder ||
    placeholder.status !== 'error' ||
    removedPendingImageIdsRef.current.has(imageId)
  ) {
    return
  }

  retryingPendingImageIdsRef.current.add(imageId)

  setPendingImages((currentImages) =>
    currentImages.map((image) =>
      image.id === imageId
        ? {
            ...image,
            errorMessage: null,
            processingLabel: null,
            retryable: undefined,
            status: 'processing' as const,
          }
        : image,
    ),
  )

  try {
    await runPendingImagePreparation({
      correlationId,
      imagePreparationTimeoutMs,
      isMountedRef,
      placeholder: {
        ...placeholder,
        errorMessage: null,
        processingLabel: null,
        retryable: undefined,
        status: 'processing',
      },
      prepareImage,
      removedPendingImageIdsRef,
      reportLocationFailure,
      revokePreviousPreviewUrl: (previousImage, preparedImage) => {
        if (previousImage.previewUrl !== preparedImage.previewUrl) {
          revokePreviewUrl(previousImage.previewUrl)
        }
      },
      revokePreviewUrl,
      setPendingImages,
      target: placeholder.selectionTarget ?? 'gallery',
      totalFiles: pendingImagesRef.current.length,
    })
  } finally {
    retryingPendingImageIdsRef.current.delete(imageId)
  }
}

export async function prepareSelectedLocationImages({
  correlationId,
  imagePreparationConcurrency,
  imagePreparationTimeoutMs = DEFAULT_IMAGE_PREPARATION_TIMEOUT_MS,
  isMountedRef,
  placeholders,
  prepareImage,
  removedPendingImageIdsRef,
  reportLocationFailure,
  revokePreviewUrl,
  setPendingImages,
  setProcessedImagesCount,
  target,
  totalFiles,
}: PrepareSelectedLocationImagesInput) {
  let processedCount = 0
  let nextPlaceholderIndex = 0

  async function processPlaceholder(placeholder: PendingLocationImageFile) {
    await runPendingImagePreparation({
      correlationId,
      imagePreparationTimeoutMs,
      isMountedRef,
      onProcessed: () => {
        if (isMountedRef.current) {
          processedCount += 1
          setProcessedImagesCount(Math.min(processedCount, totalFiles))
        }
      },
      placeholder,
      prepareImage,
      removedPendingImageIdsRef,
      reportLocationFailure,
      revokePreviewUrl,
      setPendingImages,
      target,
      totalFiles,
    })
  }

  async function runPreparationWorker() {
    while (nextPlaceholderIndex < placeholders.length) {
      const currentIndex = nextPlaceholderIndex
      nextPlaceholderIndex += 1

      const placeholder = placeholders[currentIndex]

      if (!placeholder) {
        return
      }

      await processPlaceholder(placeholder)
    }
  }

  const workerCount = Math.min(imagePreparationConcurrency, placeholders.length)

  await Promise.all(
    Array.from({ length: workerCount }, () => runPreparationWorker()),
  )
}

export async function handleSelectedLocationImageFiles({
  createCorrelationId,
  createPlaceholder,
  files,
  getNextOriginalIndex,
  imagePreparationConcurrency,
  imagePreparationTimeoutMs,
  isMountedRef,
  isReadOnly,
  pendingImagesRef,
  prepareImage,
  removedPendingImageIdsRef,
  reportLocationFailure,
  revokePreviewUrl,
  setEditDeleteErrorMessage,
  setImageSelectionTarget,
  setImageValidationErrors,
  setIsPreparingImages,
  setPendingImages,
  setProcessedImagesCount,
  setTotalImagesToProcess,
  target,
}: HandleSelectedLocationImageFilesInput) {
  if (isReadOnly || files.length === 0) {
    return
  }

  const correlationId = createCorrelationId()
  const { isCoverSelection, selectedFiles, totalFiles } = getImageSelectionPlan({ files, target })
  setTotalImagesToProcess(totalFiles)
  setProcessedImagesCount(0)
  setIsPreparingImages(true)
  setImageValidationErrors([])

  try {
    const startingOriginalIndex = getNextOriginalIndex(pendingImagesRef.current)
    setEditDeleteErrorMessage(null)
    const placeholderInputs = buildPendingImagePlaceholderInputs({
      isCoverSelection,
      selectedFiles,
      startingOriginalIndex,
      target,
    })
    const placeholders = placeholderInputs.map(({ file, ...placeholderOptions }) => {
      const placeholder = createPlaceholder(file, placeholderOptions)

      removedPendingImageIdsRef.current.delete(placeholder.id)
      return placeholder
    })

    setPendingImages((currentImages) => {
      const mergeResult = mergePendingImagePlaceholders({
        currentImages,
        isCoverSelection,
        placeholders,
      })

      mergeResult.removedImageIds.forEach((imageId) => {
        removedPendingImageIdsRef.current.add(imageId)
      })
      mergeResult.previewUrlsToRevoke.forEach(revokePreviewUrl)

      return mergeResult.nextImages
    })
    setImageSelectionTarget(null)

    await prepareSelectedLocationImages({
      correlationId,
      imagePreparationConcurrency,
      imagePreparationTimeoutMs,
      isMountedRef,
      placeholders,
      prepareImage,
      removedPendingImageIdsRef,
      reportLocationFailure,
      revokePreviewUrl,
      setPendingImages,
      setProcessedImagesCount,
      target,
      totalFiles,
    })
  } finally {
    if (isMountedRef.current) {
      setIsPreparingImages(false)
    }
  }
}
