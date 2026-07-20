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

async function readImageFileDimensions(file: File) {
  if (typeof window.createImageBitmap === 'function') {
    const bitmap = await window.createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    try {
      return {
        height: bitmap.height,
        path: 'createImageBitmap' as const,
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
      path: 'fallbackImage' as const,
      width: image.naturalWidth,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function shouldOptimizeLocationImageFile(file: File) {
  return file.size > MIN_IMAGE_SIZE_BYTES_TO_OPTIMIZE
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

async function drawFileToCanvas(file: File) {
  if (typeof window.createImageBitmap === 'function') {
    const path: OptimizationPath = 'createImageBitmap'
    const bitmap = await window.createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    const originalWidth = bitmap.width
    const originalHeight = bitmap.height
    const { width, height } = calculateTargetDimensions(originalWidth, originalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      bitmap.close()
      throw new Error('No pudimos preparar la imagen para optimizarla.')
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return {
      canvas,
      originalHeight,
      originalWidth,
      path,
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const path: OptimizationPath = 'fallbackImage'
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error('No pudimos leer la imagen seleccionada.'))
      nextImage.src = objectUrl
    })

    const originalWidth = image.naturalWidth
    const originalHeight = image.naturalHeight
    const { width, height } = calculateTargetDimensions(
      originalWidth,
      originalHeight,
    )
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No pudimos preparar la imagen para optimizarla.')
    }

    context.drawImage(image, 0, 0, width, height)

    return {
      canvas,
      originalHeight,
      originalWidth,
      path,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function optimizeLocationImageFile(
  file: File,
): Promise<OptimizeLocationImageResult> {
  const optimizeStartedAt = performance.now()

  if (!shouldOptimizeLocationImageFile(file)) {
    const dimensions = await readImageFileDimensions(file)

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
          path: dimensions.path,
          totalMs: performance.now() - optimizeStartedAt,
        },
        wasOptimized: false,
        originalSize: file.size,
        optimizedSize: file.size,
      }
  }

  const { canvas, originalHeight, originalWidth, path } = await drawFileToCanvas(file)
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

  throw new Error(
    `${file.name}: sigue superando el máximo de 10MB después de optimizar.`,
  )
}
