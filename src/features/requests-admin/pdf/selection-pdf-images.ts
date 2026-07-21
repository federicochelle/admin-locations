export const PDF_IMAGE_MAX_WIDTH = 1400
export const PDF_IMAGE_JPEG_QUALITY = 0.76

export type PreparedPdfImage = {
  dataUrl: string
  width: number
  height: number
}

function buildImageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'No se pudo procesar la imagen.'
}

async function blobToDecodedImage(
  blob: Blob,
): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return window.createImageBitmap(blob)
  }

  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()

      nextImage.onload = () => {
        resolve(nextImage)
      }

      nextImage.onerror = () => {
        reject(new Error('No se pudo decodificar la imagen.'))
      }

      nextImage.src = objectUrl
    })

    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function readImageDimensions(image: ImageBitmap | HTMLImageElement) {
  if ('width' in image && 'height' in image) {
    return {
      width: image.width,
      height: image.height,
    }
  }

  return {
    width: 0,
    height: 0,
  }
}

function cleanupDecodedImage(image: ImageBitmap | HTMLImageElement) {
  if ('close' in image && typeof image.close === 'function') {
    image.close()
  }

  if ('src' in image) {
    image.src = ''
  }
}

export async function prepareImageForPdf(
  imageUrl: string,
): Promise<PreparedPdfImage> {
  let decodedImage: ImageBitmap | HTMLImageElement | null = null
  let canvas: HTMLCanvasElement | null = null

  try {
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new Error('No pudimos descargar la imagen.')
    }

    const blob = await response.blob()

    if (!blob.type.startsWith('image/')) {
      throw new Error('El archivo recibido no es una imagen valida.')
    }

    decodedImage = await blobToDecodedImage(blob)
    const { width: sourceWidth, height: sourceHeight } =
      readImageDimensions(decodedImage)

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('No pudimos leer el tamano de la imagen.')
    }

    const scale = Math.min(1, PDF_IMAGE_MAX_WIDTH / sourceWidth)
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

    canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('No pudimos preparar el canvas para la imagen.')
    }

    context.drawImage(decodedImage, 0, 0, targetWidth, targetHeight)

    const dataUrl = canvas.toDataURL('image/jpeg', PDF_IMAGE_JPEG_QUALITY)

    return {
      dataUrl,
      width: targetWidth,
      height: targetHeight,
    }
  } catch (error) {
    throw new Error(buildImageErrorMessage(error))
  } finally {
    if (decodedImage) {
      cleanupDecodedImage(decodedImage)
    }

    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
