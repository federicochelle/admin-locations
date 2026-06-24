import { optimizeLocationImageFile } from '../locations/location-image-optimizer'
import {
  assertSupportedImageFile,
  getImageMimeTypeFromFileName,
  isHeicImageFile,
  MAX_IMAGE_SIZE_BYTES,
} from './image-upload.constants'

const HEIC_CONVERSION_QUALITY = 0.92

export type PrepareImageUploadResult = {
  file: File
  wasOptimized: boolean
  originalSize: number
  optimizedSize: number
  wasHeicConverted: boolean
}

function replaceFileExtension(filename: string, extension: string) {
  const normalizedName = filename.trim()

  if (normalizedName.length === 0) {
    return `image.${extension}`
  }

  return normalizedName.replace(/\.[^./\\]+$/, '') + `.${extension}`
}

function toFirstBlob(result: Blob | Blob[]) {
  return Array.isArray(result) ? result[0] ?? null : result
}

function normalizeImageFileType(file: File) {
  const inferredMimeType = getImageMimeTypeFromFileName(file.name)

  if (!inferredMimeType || file.type === inferredMimeType) {
    return file
  }

  return new File([file], file.name, {
    type: inferredMimeType,
    lastModified: file.lastModified,
  })
}

async function convertHeicImageFile(file: File) {
  try {
    const { default: heic2any } = await import('heic2any')
    const convertedBlob = toFirstBlob(
      await heic2any({
        blob: file,
        quality: HEIC_CONVERSION_QUALITY,
        toType: 'image/jpeg',
      }),
    )

    if (!convertedBlob) {
      throw new Error('La conversión no devolvió una imagen válida.')
    }

    return new File(
      [convertedBlob],
      replaceFileExtension(file.name, 'jpg'),
      {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      },
    )
  } catch (error) {
    throw new Error(
      `${file.name}: no pudimos convertir la imagen HEIC/HEIF automáticamente.`,
      {
        cause: error,
      },
    )
  }
}

export async function prepareImageUploadFile(
  file: File,
): Promise<PrepareImageUploadResult> {
  assertSupportedImageFile(file)

  const normalizedInputFile = normalizeImageFileType(file)
  const normalizedFile = isHeicImageFile(normalizedInputFile)
    ? await convertHeicImageFile(normalizedInputFile)
    : normalizedInputFile

  const optimizationResult = await optimizeLocationImageFile(normalizedFile)

  if (optimizationResult.file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `${file.name}: sigue superando el máximo de 10MB después de optimizar.`,
    )
  }

  return {
    ...optimizationResult,
    file: optimizationResult.file,
    wasHeicConverted: normalizedFile !== file,
  }
}
