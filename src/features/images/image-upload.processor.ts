import { optimizeLocationImageFile } from '../locations/location-image-optimizer'
import {
  assertSupportedImageFile,
  getImageMimeTypeFromFileName,
  isHeicImageFile,
  MAX_IMAGE_SIZE_BYTES,
} from './image-upload.constants'

const HEIC_RESIZE_MAX_DIMENSION = 2400
const HEIC_OUTPUT_QUALITY_STEPS = [0.85, 0.82] as const

export type PrepareImageUploadResult = {
  file: File
  outputDimensions: {
    width: number
    height: number
  }
  wasOptimized: boolean
  originalSize: number
  optimizedSize: number
  wasHeicConverted: boolean
  heicPerf?: {
    conversionMs: number
    convertedMimeType: string
    convertedSize: number
    decodeMs: number
    originalMimeType: string
    originalSize: number
    resizeEncodeMs: number
    startedAt: number
    totalMs: number
    outputDimensions: {
      width: number
      height: number
    }
    inputDimensions: {
      width: number
      height: number
    }
  }
}

type HeicConversionResult = {
  convertedMimeType: string
  convertedSize: number
  decodeMs: number
  file: File
  inputDimensions: {
    width: number
    height: number
  }
  resizeEncodeMs: number
  totalMs: number
  outputDimensions: {
    width: number
    height: number
  }
}

function bytesToMb(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

function replaceFileExtension(filename: string, extension: string) {
  const normalizedName = filename.trim()

  if (normalizedName.length === 0) {
    return `image.${extension}`
  }

  return normalizedName.replace(/\.[^./\\]+$/, '') + `.${extension}`
}

function logHeicConversionError(file: File, error: unknown) {
  const errorDetails =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          causeStack: error.cause instanceof Error ? error.cause.stack : undefined,
        }
      : {
          message: String(error),
        }

  console.error('[HEIC CONVERSION FAILED]', {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    error,
    ...errorDetails,
  })
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

function calculateTargetDimensions(width: number, height: number) {
  const largestSide = Math.max(width, height)

  if (largestSide <= HEIC_RESIZE_MAX_DIMENSION) {
    return { width, height }
  }

  const scale = HEIC_RESIZE_MAX_DIMENSION / largestSide

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function readImageFileDimensions(file: File) {
  if (typeof window.createImageBitmap === 'function') {
    const bitmap = await window.createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    try {
      return {
        height: bitmap.height,
        width: bitmap.width,
      }
    } finally {
      bitmap.close()
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error('No pudimos leer la imagen seleccionada.'))
      nextImage.src = objectUrl
    })

    return {
      height: image.naturalHeight,
      width: image.naturalWidth,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('La conversión no devolvió una imagen válida.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

async function convertHeicImageFile(file: File): Promise<HeicConversionResult> {
  const totalStartedAt = performance.now()

  try {
    const { heicTo } = await import('heic-to')
    const decodeStartedAt = performance.now()
    const convertedBitmap = await heicTo({
      blob: file,
      type: 'bitmap',
    })
    const decodeMs = performance.now() - decodeStartedAt

    if (!(convertedBitmap instanceof ImageBitmap)) {
      throw new Error('La conversión no devolvió una imagen válida.')
    }

    const inputDimensions = {
      width: convertedBitmap.width,
      height: convertedBitmap.height,
    }
    const outputDimensions = calculateTargetDimensions(
      convertedBitmap.width,
      convertedBitmap.height,
    )
    const canvas = document.createElement('canvas')
    canvas.width = outputDimensions.width
    canvas.height = outputDimensions.height

    try {
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('No pudimos preparar la imagen para convertirla.')
      }

      const resizeEncodeStartedAt = performance.now()
      context.drawImage(
        convertedBitmap,
        0,
        0,
        outputDimensions.width,
        outputDimensions.height,
      )

      let convertedBlob: Blob | null = null

      for (const quality of HEIC_OUTPUT_QUALITY_STEPS) {
        const nextBlob = await canvasToBlob(canvas, quality)

        if (nextBlob.size > MAX_IMAGE_SIZE_BYTES) {
          continue
        }

        convertedBlob = nextBlob
        break
      }

      if (!convertedBlob || convertedBlob.size === 0) {
        throw new Error('La conversión no devolvió una imagen válida.')
      }

      const resizeEncodeMs = performance.now() - resizeEncodeStartedAt
      const convertedFile = new File(
        [convertedBlob],
        replaceFileExtension(file.name, 'jpg'),
        {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        },
      )

      return {
        convertedMimeType: convertedBlob.type || convertedFile.type,
        convertedSize: convertedBlob.size,
        decodeMs,
        file: convertedFile,
        inputDimensions,
        outputDimensions,
        resizeEncodeMs,
        totalMs: performance.now() - totalStartedAt,
      }
    } finally {
      convertedBitmap.close()
      canvas.width = 1
      canvas.height = 1
    }
  } catch (error) {
    logHeicConversionError(file, error)

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

  const totalStartedAt = performance.now()
  const normalizedInputFile = normalizeImageFileType(file)
  const isHeic = isHeicImageFile(normalizedInputFile)

  if (isHeic) {
    console.groupCollapsed(`[HEIC_PERF] ${normalizedInputFile.name}`)
    console.log('[HEIC_PERF] start', {
      fileName: normalizedInputFile.name,
      mimeType: normalizedInputFile.type,
      originalSizeMb: bytesToMb(normalizedInputFile.size),
    })
  }

  const heicConversionResult = isHeic
    ? await convertHeicImageFile(normalizedInputFile)
    : null
  const normalizedFile = heicConversionResult
    ? heicConversionResult.file
    : normalizedInputFile

  const optimizationResult = heicConversionResult
    ? {
        file: heicConversionResult.file,
        outputDimensions: heicConversionResult.outputDimensions,
        optimizedSize: heicConversionResult.file.size,
        originalSize: normalizedInputFile.size,
        wasOptimized: true,
      }
    : await optimizeLocationImageFile(normalizedFile)

  if (heicConversionResult) {
    console.log('[HEIC_PERF] conversion', {
      decodeMs: Number(heicConversionResult.decodeMs.toFixed(2)),
      durationMs: Number(heicConversionResult.totalMs.toFixed(2)),
      inputDimensions: heicConversionResult.inputDimensions,
      outputDimensions: heicConversionResult.outputDimensions,
      resultMimeType: heicConversionResult.convertedMimeType,
      resultSizeMb: bytesToMb(heicConversionResult.convertedSize),
      resizeEncodeMs: Number(heicConversionResult.resizeEncodeMs.toFixed(2)),
    })
  }

  if (optimizationResult.file.size > MAX_IMAGE_SIZE_BYTES) {
    if (isHeic) {
      console.groupEnd()
    }

    throw new Error(
      `${file.name}: sigue superando el máximo de 10MB después de optimizar.`,
    )
  }

  const result = {
    ...optimizationResult,
    file: optimizationResult.file,
    heicPerf: heicConversionResult
      ? {
          conversionMs: heicConversionResult.totalMs,
          convertedMimeType: heicConversionResult.convertedMimeType,
          convertedSize: heicConversionResult.convertedSize,
          decodeMs: heicConversionResult.decodeMs,
          inputDimensions: heicConversionResult.inputDimensions,
          originalMimeType: normalizedInputFile.type,
          originalSize: normalizedInputFile.size,
          outputDimensions: heicConversionResult.outputDimensions,
          resizeEncodeMs: heicConversionResult.resizeEncodeMs,
          startedAt: totalStartedAt,
          totalMs: performance.now() - totalStartedAt,
        }
      : undefined,
    wasHeicConverted: Boolean(heicConversionResult),
  }

  return result
}

export async function prepareProductionCompanyLogoFile(
  file: File,
): Promise<PrepareImageUploadResult> {
  assertSupportedImageFile(file)

  const totalStartedAt = performance.now()
  const normalizedInputFile = normalizeImageFileType(file)
  const isHeic = isHeicImageFile(normalizedInputFile)

  if (isHeic) {
    console.groupCollapsed(`[HEIC_PERF] ${normalizedInputFile.name}`)
    console.log('[HEIC_PERF] start', {
      fileName: normalizedInputFile.name,
      mimeType: normalizedInputFile.type,
      originalSizeMb: bytesToMb(normalizedInputFile.size),
    })
  }

  const heicConversionResult = isHeic
    ? await convertHeicImageFile(normalizedInputFile)
    : null
  const preparedFile = heicConversionResult
    ? heicConversionResult.file
    : normalizedInputFile

  if (heicConversionResult) {
    console.log('[HEIC_PERF] conversion', {
      decodeMs: Number(heicConversionResult.decodeMs.toFixed(2)),
      durationMs: Number(heicConversionResult.totalMs.toFixed(2)),
      inputDimensions: heicConversionResult.inputDimensions,
      outputDimensions: heicConversionResult.outputDimensions,
      resultMimeType: heicConversionResult.convertedMimeType,
      resultSizeMb: bytesToMb(heicConversionResult.convertedSize),
      resizeEncodeMs: Number(heicConversionResult.resizeEncodeMs.toFixed(2)),
    })
  }

  if (preparedFile.size > MAX_IMAGE_SIZE_BYTES) {
    if (isHeic) {
      console.groupEnd()
    }

    throw new Error(
      `${file.name}: sigue superando el máximo de 10MB después de procesar.`,
    )
  }

  const outputDimensions = heicConversionResult
    ? heicConversionResult.outputDimensions
    : await readImageFileDimensions(preparedFile)

  return {
    file: preparedFile,
    outputDimensions,
    wasOptimized: Boolean(heicConversionResult),
    originalSize: normalizedInputFile.size,
    optimizedSize: preparedFile.size,
    heicPerf: heicConversionResult
      ? {
          conversionMs: heicConversionResult.totalMs,
          convertedMimeType: heicConversionResult.convertedMimeType,
          convertedSize: heicConversionResult.convertedSize,
          decodeMs: heicConversionResult.decodeMs,
          inputDimensions: heicConversionResult.inputDimensions,
          originalMimeType: normalizedInputFile.type,
          originalSize: normalizedInputFile.size,
          outputDimensions: heicConversionResult.outputDimensions,
          resizeEncodeMs: heicConversionResult.resizeEncodeMs,
          startedAt: totalStartedAt,
          totalMs: performance.now() - totalStartedAt,
        }
      : undefined,
    wasHeicConverted: Boolean(heicConversionResult),
  }
}
