export const IMAGE_DECODE_ERROR_MESSAGE =
  'No pudimos procesar esta imagen. Probá con otra imagen o guardala nuevamente como JPG.'

export type DecodedImage = {
  source: CanvasImageSource
  width: number
  height: number
  path: 'createImageBitmap' | 'fallbackImage'
  release: () => void
}

// The caller owns the decoded source and must release it in a finally block.
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  let bitmapError: unknown
  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' })
      let released = false
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        path: 'createImageBitmap',
        release() {
          if (!released) {
            released = true
            bitmap.close()
          }
        },
      }
    } catch (error) {
      bitmapError = error
    }
  }

  let objectUrl: string | undefined
  const release = () => {
    if (objectUrl !== undefined) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = undefined
    }
  }
  try {
    const sourceUrl = URL.createObjectURL(file)
    objectUrl = sourceUrl
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => {
        element.onload = null
        element.onerror = null
        if (element.naturalWidth > 0 && element.naturalHeight > 0) resolve(element)
        else reject(new Error('Invalid image dimensions'))
      }
      element.onerror = () => {
        element.onload = null
        element.onerror = null
        reject(new Error('HTMLImageElement could not decode the image'))
      }
      element.src = sourceUrl
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      path: 'fallbackImage',
      release,
    }
  } catch (error) {
    release()
    throw new Error(IMAGE_DECODE_ERROR_MESSAGE, {
      cause: new AggregateError([bitmapError, error], 'Image decoding failed'),
    })
  }
}

export async function readImageFileDimensions(file: Blob) {
  const image = await decodeImage(file)
  try {
    return { width: image.width, height: image.height, path: image.path }
  } finally {
    image.release()
  }
}
