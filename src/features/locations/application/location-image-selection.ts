import type { PendingLocationImageFile } from '../location-images.types'
import type { AdminErrorContext } from '../../../lib/admin-error-reporting'

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
) {
  return currentImages.map((image) =>
    image.id === imageId
      ? {
          ...image,
          errorMessage: message,
          processingLabel: null,
          status: 'error' as const,
        }
      : image,
  )
}

export async function prepareSelectedLocationImages({
  correlationId,
  imagePreparationConcurrency,
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
    try {
      const preparedImage = await prepareImage(placeholder.file, {
        id: placeholder.id,
        isCover: placeholder.isCover,
        onStatusChange: (processingLabel) => {
          if (!isMountedRef.current || removedPendingImageIdsRef.current.has(placeholder.id)) {
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
      })

      if (
        !isMountedRef.current ||
        removedPendingImageIdsRef.current.has(preparedImage.id)
      ) {
        revokePreviewUrl(preparedImage.previewUrl)
        return
      }

      setPendingImages((currentImages) =>
        applyPreparedImageToPendingImages(currentImages, preparedImage),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `${placeholder.file.name}: no pudimos optimizar la imagen seleccionada.`

      if (isMountedRef.current && !removedPendingImageIdsRef.current.has(placeholder.id)) {
        reportLocationFailure(error, { operation: 'location.image.prepare', resourceType: 'image', stage: 'images.prepare', provider: 'browser', correlationId, extraSafeContext: { image_count: totalFiles, image_index: placeholder.originalIndex, image_mime: placeholder.file.type, image_bytes: placeholder.file.size } })
      }

      if (!isMountedRef.current || removedPendingImageIdsRef.current.has(placeholder.id)) {
        return
      }

      setPendingImages((currentImages) =>
        applyImagePreparationErrorToPendingImages(
          currentImages,
          placeholder.id,
          message,
        ),
      )
    } finally {
      if (isMountedRef.current) {
        processedCount += 1
        setProcessedImagesCount(Math.min(processedCount, totalFiles))
      }
    }
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
