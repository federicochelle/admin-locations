import { decodeImage, type DecodedImage } from '../images/decode-image'
import { markExpectedAdminError } from '../../lib/admin-error-reporting'

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_SIZE_BYTES_TO_OPTIMIZE = 1.5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 2400
const JPEG_QUALITY_STEPS = [0.85, 0.82] as const
type OptimizationPath = 'createImageBitmap' | 'fallbackImage' | 'skipped'

export type OptimizeLocationImageResult = {
  file: File
  outputDimensions: {
    width: number
    height: number
  }
  wasOptimized: boolean
  originalSize: number
  optimizedSize: number
  perf?: {
    inputDimensions: {
      width: number
      height: number
    } | null
    outputDimensions: {
      width: number
      height: number
    } | null
    path: OptimizationPath
    totalMs: number
  }
}

export function shouldOptimizeLocationImageFile(
  file: File,
  dimensions: { width: number; height: number },
) {
  return (
    file.size > MIN_IMAGE_SIZE_BYTES_TO_OPTIMIZE ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION
  )
}

function replaceFileExtension(filename: string, extension: string) {
  const normalizedName = filename.trim()

  if (normalizedName.length === 0) {
    return `image.${extension}`
  }

  return normalizedName.replace(/\.[^./\\]+$/, '') + `.${extension}`
}

function calculateTargetDimensions(width: number, height: number) {
  const largestSide = Math.max(width, height)

  if (largestSide <= MAX_IMAGE_DIMENSION) {
    return { width, height }
  }

  const scale = MAX_IMAGE_DIMENSION / largestSide

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
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
          reject(new Error('No pudimos optimizar la imagen seleccionada.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

function drawImageToCanvas(image: DecodedImage) {
  const { width, height } = calculateTargetDimensions(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No pudimos preparar la imagen para optimizarla.')
  context.drawImage(image.source, 0, 0, width, height)
  return { canvas, originalWidth: image.width, originalHeight: image.height, path: image.path }
}

export async function optimizeLocationImageFile(
  file: File,
): Promise<OptimizeLocationImageResult> {
  const optimizeStartedAt = performance.now()
  const image = await decodeImage(file)
  let canvasResult: ReturnType<typeof drawImageToCanvas>

  try {
    const dimensions = { width: image.width, height: image.height }

    if (!shouldOptimizeLocationImageFile(file, dimensions)) {
      console.log(
        '[IMAGE OPTIMIZER]',
        file.name,
        'sin cambios',
        `original=${(file.size / 1024 / 1024).toFixed(2)} MB`,
        `final=${(file.size / 1024 / 1024).toFixed(2)} MB`,
      )

      return {
        file,
        outputDimensions: {
          width: dimensions.width,
          height: dimensions.height,
        },
        perf: {
          inputDimensions: {
            width: dimensions.width,
            height: dimensions.height,
          },
          outputDimensions: {
            width: dimensions.width,
            height: dimensions.height,
          },
          path: image.path,
          totalMs: performance.now() - optimizeStartedAt,
        },
        wasOptimized: false,
        originalSize: file.size,
        optimizedSize: file.size,
      }
    }

    canvasResult = drawImageToCanvas(image)
  } finally {
    image.release()
  }

  const { canvas, originalHeight, originalWidth, path } = canvasResult
  const dimensionsLabel = `${canvas.width}x${canvas.height}`

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality)

    if (blob.size > MAX_IMAGE_SIZE_BYTES) {
      continue
    }

    const optimizedFile = new File(
      [blob],
      replaceFileExtension(file.name, 'jpg'),
      {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      },
    )

    console.log(
      '[IMAGE OPTIMIZER]',
      file.name,
      `original=${(file.size / 1024 / 1024).toFixed(2)} MB`,
      `final=${(optimizedFile.size / 1024 / 1024).toFixed(2)} MB`,
      dimensionsLabel,
      `quality=${quality}`,
    )

    return {
      file: optimizedFile,
      outputDimensions: {
        width: canvas.width,
        height: canvas.height,
      },
      perf: {
        inputDimensions: {
          width: originalWidth,
          height: originalHeight,
        },
        outputDimensions: {
          width: canvas.width,
          height: canvas.height,
        },
        path,
        totalMs: performance.now() - optimizeStartedAt,
      },
      wasOptimized: true,
      originalSize: file.size,
      optimizedSize: optimizedFile.size,
    }
  }

  throw markExpectedAdminError(new Error(
    `${file.name}: sigue superando el máximo de 10MB después de optimizar.`,
  ))
}
