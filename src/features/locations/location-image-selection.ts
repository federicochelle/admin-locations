import { prepareImageUploadFile } from '../images/image-upload.processor'
import { applyFaceBlurToImage } from './location-face-blur'
import { detectLocationImageSensitiveContent } from './location-sensitive-content.service'
import type { PendingLocationImageFile } from './location-images.types'

const PLACEHOLDER_PREVIEW_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

export type PendingImageSelectionTarget = 'cover' | 'gallery'

export type CreatePendingLocationImagePlaceholderOptions = {
  id?: string
  isCover: boolean
  originalIndex: number
  target: PendingImageSelectionTarget
}

export type PreparePendingLocationImageOptions = {
  id: string
  isCover: boolean
  originalIndex: number
  target: PendingImageSelectionTarget
  onStatusChange?: (statusLabel: string) => void
}

export type PreparePendingLocationImagesOptions = {
  isCoverSelection: boolean
  startingOriginalIndex: number
  onProcessed?: (processed: number, total: number) => void
}

export type PreparePendingLocationImagesResult = {
  images: PendingLocationImageFile[]
  errors: string[]
}

export function createPendingLocationImagePlaceholder(
  file: File,
  options: CreatePendingLocationImagePlaceholderOptions,
): PendingLocationImageFile {
  return {
    id: options.id ?? crypto.randomUUID(),
    file,
    height: 0,
    previewUrl: PLACEHOLDER_PREVIEW_URL,
    originalIndex: options.originalIndex,
    isCover: options.isCover,
    selectionTarget: options.target,
    status: 'processing',
    width: 0,
    errorMessage: null,
  }
}

export async function preparePendingLocationImage(
  file: File,
  options: PreparePendingLocationImageOptions,
): Promise<PendingLocationImageFile> {
  const prepareResult = await prepareImageUploadFile(file)
  const optimizedFile = prepareResult.file

  options.onStatusChange?.('Analizando rostros...')

  let finalFile = optimizedFile

  try {
    const detectionResult = await detectLocationImageSensitiveContent(optimizedFile)

    if (detectionResult.summary.faces > 0) {
      finalFile = await applyFaceBlurToImage(optimizedFile, detectionResult.faces)
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `No se pudo verificar el rostro de esta imagen. Intenta nuevamente.`
        : 'No se pudo verificar el rostro de esta imagen. Intenta nuevamente.',
      {
        cause: error,
      },
    )
  }

  return {
    id: options.id,
    file: finalFile,
    height: prepareResult.outputDimensions.height,
    previewUrl: URL.createObjectURL(finalFile),
    originalIndex: options.originalIndex,
    isCover: options.isCover,
    processingLabel: null,
    selectionTarget: options.target,
    status: 'pending',
    width: prepareResult.outputDimensions.width,
    errorMessage: null,
  }
}

export async function preparePendingLocationImages(
  files: File[],
  options: PreparePendingLocationImagesOptions,
): Promise<PreparePendingLocationImagesResult> {
  if (files.length === 0) {
    return {
      errors: [],
      images: [],
    }
  }

  const nextErrors: string[] = []
  const nextImages: PendingLocationImageFile[] = []
  const selectedFiles = options.isCoverSelection ? files.slice(0, 1) : files

  for (const [index, file] of selectedFiles.entries()) {
    try {
      nextImages.push(
        await preparePendingLocationImage(file, {
          id: crypto.randomUUID(),
          isCover: options.isCoverSelection && index === 0,
          onStatusChange: undefined,
          originalIndex: options.startingOriginalIndex + nextImages.length,
          target: options.isCoverSelection ? 'cover' : 'gallery',
        }),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `${file.name}: no pudimos optimizar la imagen seleccionada.`

      nextErrors.push(message)
    } finally {
      options.onProcessed?.(index + 1, selectedFiles.length)
    }
  }

  return {
    errors: nextErrors,
    images: nextImages,
  }
}
