import { prepareImageUploadFile } from '../images/image-upload.processor'
import { isHeicImageFile } from '../images/image-upload.constants'
import type { PendingLocationImageFile } from './location-images.types'

export type PreparePendingLocationImagesOptions = {
  isCoverSelection: boolean
  startingOriginalIndex: number
  onProcessed?: (processed: number, total: number) => void
}

export type PreparePendingLocationImagesResult = {
  images: PendingLocationImageFile[]
  errors: string[]
}

function bytesToMb(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

function roundMs(value: number) {
  return Number(value.toFixed(2))
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
      const prepareResult = await prepareImageUploadFile(file)
      const optimizedFile = prepareResult.file
      const dimensionsLabel = `${prepareResult.outputDimensions.width}x${prepareResult.outputDimensions.height}`

      if (prepareResult.heicPerf) {
        console.log('[HEIC_PERF] summary', {
          convertedSizeMb: bytesToMb(prepareResult.heicPerf.convertedSize),
          conversionMs: roundMs(prepareResult.heicPerf.conversionMs),
          decodeMs: roundMs(prepareResult.heicPerf.decodeMs),
          fileName: file.name,
          optimizedSizeMb: bytesToMb(optimizedFile.size),
          originalSizeMb: bytesToMb(prepareResult.heicPerf.originalSize),
          resizeEncodeMs: roundMs(prepareResult.heicPerf.resizeEncodeMs),
          totalMs: roundMs(prepareResult.heicPerf.totalMs),
        })
        console.groupEnd()
      }

      console.log(
        '[IMAGE SIZE]',
        optimizedFile.name,
        `${(optimizedFile.size / 1024).toFixed(0)} KB`,
        `${(optimizedFile.size / 1024 / 1024).toFixed(2)} MB`,
        dimensionsLabel,
        `${selectedFiles.length} seleccionadas`,
      )

      nextImages.push({
        id: crypto.randomUUID(),
        file: optimizedFile,
        height: prepareResult.outputDimensions.height,
        previewUrl: URL.createObjectURL(optimizedFile),
        originalIndex: options.startingOriginalIndex + nextImages.length,
        isCover: options.isCoverSelection && index === 0,
        status: 'pending',
        width: prepareResult.outputDimensions.width,
      })
    } catch (error) {
      if (isHeicImageFile(file)) {
        console.groupEnd()
      }

      const message =
        error instanceof Error
          ? error.message
          : `${file.name}: no pudimos optimizar la imagen seleccionada.`

      nextErrors.push(message)
    } finally {
      options.onProcessed?.(index + 1, selectedFiles.length)
    }
  }

  const totalBytes = nextImages.reduce((sum, image) => sum + image.file.size, 0)

  console.log(
    '[UPLOAD BATCH]',
    `${nextImages.length} imágenes`,
    `${(totalBytes / 1024 / 1024).toFixed(2)} MB totales`,
  )

  return {
    errors: nextErrors,
    images: nextImages,
  }
}
