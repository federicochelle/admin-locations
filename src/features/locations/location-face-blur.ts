import type { LocationSensitiveContentFace } from './location-sensitive-content.service'

export type BlurRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type BlurStrokePoint = {
  x: number
  y: number
}

export type BlurStroke = {
  points: BlurStrokePoint[]
  radius: number
}

type LoadedImageSource = {
  width: number
  height: number
  source: CanvasImageSource
  release: () => void
}

export const FACE_BLUR_FILTER = 'blur(18px)'
const JPEG_WEBP_QUALITY = 0.92
const LARGE_FACE_BLUR_EXPANSION_RATIO = 0.18
const MEDIUM_FACE_BLUR_EXPANSION_RATIO = 0.22
const SMALL_FACE_BLUR_EXPANSION_RATIO = 0.28
const SMALL_FACE_AREA_RATIO_THRESHOLD = 0.015
const MEDIUM_FACE_AREA_RATIO_THRESHOLD = 0.05

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function replaceFileExtension(filename: string, extension: string) {
  const normalizedName = filename.trim()

  if (normalizedName.length === 0) {
    return `image.${extension}`
  }

  return normalizedName.replace(/\.[^./\\]+$/, '') + `.${extension}`
}

function getCanvasOutputFormat(file: File) {
  if (file.type === 'image/png') {
    return {
      extension: 'png',
      mimeType: 'image/png',
      quality: undefined,
    }
  }

  if (file.type === 'image/webp') {
    return {
      extension: 'webp',
      mimeType: 'image/webp',
      quality: JPEG_WEBP_QUALITY,
    }
  }

  return {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    quality: JPEG_WEBP_QUALITY,
  }
}

function clampRegion(
  region: BlurRegion,
  imageWidth: number,
  imageHeight: number,
): BlurRegion {
  const x = clamp(Math.floor(region.x), 0, imageWidth)
  const y = clamp(Math.floor(region.y), 0, imageHeight)
  const maxX = clamp(Math.ceil(region.x + region.width), 0, imageWidth)
  const maxY = clamp(Math.ceil(region.y + region.height), 0, imageHeight)

  return {
    x,
    y,
    width: Math.max(0, maxX - x),
    height: Math.max(0, maxY - y),
  }
}

function normalizeStroke(
  stroke: BlurStroke,
  imageWidth: number,
  imageHeight: number,
): BlurStroke | null {
  const normalizedPoints = stroke.points
    .map((point) => ({
      x: clamp(point.x, 0, imageWidth),
      y: clamp(point.y, 0, imageHeight),
    }))
    .filter((point, index, points) => {
      if (index === 0) {
        return true
      }

      const previousPoint = points[index - 1]

      return previousPoint.x !== point.x || previousPoint.y !== point.y
    })

  if (normalizedPoints.length === 0) {
    return null
  }

  return {
    points: normalizedPoints,
    radius: Math.max(1, stroke.radius),
  }
}

function getFaceBlurExpansionRatio(
  box: LocationSensitiveContentFace['boundingBox'],
  imageWidth: number,
  imageHeight: number,
) {
  const imageArea = imageWidth * imageHeight

  if (imageArea <= 0) {
    return LARGE_FACE_BLUR_EXPANSION_RATIO
  }

  const faceAreaRatio = (box.width * box.height) / imageArea

  if (faceAreaRatio < SMALL_FACE_AREA_RATIO_THRESHOLD) {
    return SMALL_FACE_BLUR_EXPANSION_RATIO
  }

  if (faceAreaRatio < MEDIUM_FACE_AREA_RATIO_THRESHOLD) {
    return MEDIUM_FACE_BLUR_EXPANSION_RATIO
  }

  return LARGE_FACE_BLUR_EXPANSION_RATIO
}

function expandFaceToBlurRegion(
  face: LocationSensitiveContentFace,
  imageWidth: number,
  imageHeight: number,
): BlurRegion {
  const expansionRatio = getFaceBlurExpansionRatio(
    face.boundingBox,
    imageWidth,
    imageHeight,
  )

  return clampRegion(
    {
      x: face.boundingBox.x - face.boundingBox.width * expansionRatio,
      y: face.boundingBox.y - face.boundingBox.height * expansionRatio,
      width: face.boundingBox.width * (1 + expansionRatio * 2),
      height: face.boundingBox.height * (1 + expansionRatio * 2),
    },
    imageWidth,
    imageHeight,
  )
}

function getExpandedFaceRegions(
  faces: LocationSensitiveContentFace[],
  imageWidth: number,
  imageHeight: number,
) {
  return faces.map((face) =>
    expandFaceToBlurRegion(face, imageWidth, imageHeight),
  )
}

async function loadImageSource(file: File): Promise<LoadedImageSource> {
  if (typeof window.createImageBitmap === 'function') {
    const bitmap = await window.createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    return {
      height: bitmap.height,
      release: () => bitmap.close(),
      source: bitmap,
      width: bitmap.width,
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error('No pudimos preparar la imagen para blur de rostros.'))
      nextImage.src = objectUrl
    })

    return {
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
      source: image,
      width: image.naturalWidth,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No pudimos serializar la imagen con blur.'))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

function drawStrokeMask(
  context: CanvasRenderingContext2D,
  stroke: BlurStroke,
) {
  if (stroke.points.length === 0) {
    return
  }

  const [firstPoint, ...remainingPoints] = stroke.points

  context.save()
  context.fillStyle = '#ffffff'
  context.strokeStyle = '#ffffff'
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = stroke.radius * 2
  context.filter = 'blur(4px)'

  if (remainingPoints.length === 0) {
    context.beginPath()
    context.arc(firstPoint.x, firstPoint.y, stroke.radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
    return
  }

  context.beginPath()
  context.moveTo(firstPoint.x, firstPoint.y)

  for (const point of remainingPoints) {
    context.lineTo(point.x, point.y)
  }

  context.stroke()
  context.restore()
}

async function renderBlurredCanvas(
  file: File,
  options: {
    regions?: BlurRegion[]
    strokes?: BlurStroke[]
  },
) {
  const { height, release, source, width } = await loadImageSource(file)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No pudimos preparar el canvas para blur.')
    }

    context.drawImage(source, 0, 0, width, height)

    const regions = options.regions ?? []
    const strokes = (options.strokes ?? [])
      .map((stroke) => normalizeStroke(stroke, width, height))
      .filter((stroke): stroke is BlurStroke => stroke !== null)

    if (regions.length > 0 || strokes.length > 0) {
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = width
      sourceCanvas.height = height
      const sourceContext = sourceCanvas.getContext('2d')

      if (!sourceContext) {
        throw new Error('No pudimos preparar la imagen base para blur.')
      }

      sourceContext.drawImage(source, 0, 0, width, height)

      if (regions.length > 0) {
        for (const region of regions) {
          const clampedRegion = clampRegion(region, width, height)

          if (clampedRegion.width === 0 || clampedRegion.height === 0) {
            continue
          }

          context.save()
          context.filter = FACE_BLUR_FILTER
          context.drawImage(
            sourceCanvas,
            clampedRegion.x,
            clampedRegion.y,
            clampedRegion.width,
            clampedRegion.height,
            clampedRegion.x,
            clampedRegion.y,
            clampedRegion.width,
            clampedRegion.height,
          )
          context.restore()
        }
      }

      if (strokes.length > 0) {
        const blurredCanvas = document.createElement('canvas')
        blurredCanvas.width = width
        blurredCanvas.height = height
        const blurredContext = blurredCanvas.getContext('2d')

        if (!blurredContext) {
          throw new Error('No pudimos preparar la imagen difuminada.')
        }

        blurredContext.save()
        blurredContext.filter = FACE_BLUR_FILTER
        blurredContext.drawImage(sourceCanvas, 0, 0, width, height)
        blurredContext.restore()

        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = width
        maskCanvas.height = height
        const maskContext = maskCanvas.getContext('2d')

        if (!maskContext) {
          throw new Error('No pudimos preparar la mascara de blur.')
        }

        for (const stroke of strokes) {
          drawStrokeMask(maskContext, stroke)
        }

        const compositeCanvas = document.createElement('canvas')
        compositeCanvas.width = width
        compositeCanvas.height = height
        const compositeContext = compositeCanvas.getContext('2d')

        if (!compositeContext) {
          throw new Error('No pudimos preparar la composicion de blur.')
        }

        compositeContext.drawImage(blurredCanvas, 0, 0, width, height)
        compositeContext.globalCompositeOperation = 'destination-in'
        compositeContext.drawImage(maskCanvas, 0, 0, width, height)
        compositeContext.globalCompositeOperation = 'source-over'

        context.drawImage(compositeCanvas, 0, 0, width, height)
      }
    }

    return {
      canvas,
      height,
      width,
    }
  } finally {
    release()
  }
}

export async function applyBlurToImageRegions(
  file: File,
  regions: BlurRegion[],
): Promise<File> {
  if (regions.length === 0) {
    return file
  }

  const { canvas } = await renderBlurredCanvas(file, { regions })
  const outputFormat = getCanvasOutputFormat(file)
  const blob = await canvasToBlob(
    canvas,
    outputFormat.mimeType,
    outputFormat.quality,
  )

  return new File(
    [blob],
    replaceFileExtension(file.name, outputFormat.extension),
    {
      type: blob.type || outputFormat.mimeType,
      lastModified: file.lastModified,
    },
  )
}

export async function applyBlurStrokesToImage(
  file: File,
  strokes: BlurStroke[],
): Promise<File> {
  if (strokes.length === 0) {
    return file
  }

  const { canvas } = await renderBlurredCanvas(file, { strokes })
  const outputFormat = getCanvasOutputFormat(file)
  const blob = await canvasToBlob(
    canvas,
    outputFormat.mimeType,
    outputFormat.quality,
  )

  return new File(
    [blob],
    replaceFileExtension(file.name, outputFormat.extension),
    {
      type: blob.type || outputFormat.mimeType,
      lastModified: file.lastModified,
    },
  )
}

export async function applyFaceBlurToImage(
  file: File,
  faces: LocationSensitiveContentFace[],
): Promise<File> {
  if (faces.length === 0) {
    return file
  }

  const loadedSource = await loadImageSource(file)

  try {
    return await applyBlurToImageRegions(
      file,
      getExpandedFaceRegions(faces, loadedSource.width, loadedSource.height),
    )
  } finally {
    loadedSource.release()
  }
}
