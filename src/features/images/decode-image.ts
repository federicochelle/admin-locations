export const IMAGE_DECODE_ERROR_MESSAGE =
  'No pudimos procesar esta imagen. Probá con otra imagen o guardala nuevamente como JPG.'

const DEFAULT_IMAGE_DECODE_TIMEOUT_MS = 30_000

function getImageDecodeTimeoutMs() {
  const override = (globalThis as { __LOCATION_IMAGE_DECODE_TIMEOUT_MS__?: unknown }).__LOCATION_IMAGE_DECODE_TIMEOUT_MS__
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? override
    : DEFAULT_IMAGE_DECODE_TIMEOUT_MS
}

function runDecodeWithTimeout<T>(
  action: () => Promise<T>,
  options: {
    cleanupLateResult?: (value: T) => void
    onTimeout?: () => void
  } = {},
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const actionPromise = action()

  actionPromise.then(
    (value) => {
      if (timedOut) {
        options.cleanupLateResult?.(value)
      }
    },
    () => {},
  )

  return Promise.race([
    actionPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true
        options.onTimeout?.()
        const error = new Error('La lectura de la imagen demoró demasiado.') as Error & {
          provider: string
          stage: string
          timeoutMs: number
        }
        error.name = 'AdminOperationTimeoutError'
        error.provider = 'browser'
        error.stage = 'images.prepare'
        error.timeoutMs = getImageDecodeTimeoutMs()
        reject(error)
      }, getImageDecodeTimeoutMs())
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  })
}

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
      const bitmap = await runDecodeWithTimeout(
        () => window.createImageBitmap(file, { imageOrientation: 'from-image' }),
        {
          cleanupLateResult: (lateBitmap) => {
            lateBitmap.close()
          },
        },
      )
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
    let element: HTMLImageElement | undefined
    const cleanupElement = () => {
      if (element) {
        element.onload = null
        element.onerror = null
        element.src = ''
      }
    }
    const image = await runDecodeWithTimeout(
      () => new Promise<HTMLImageElement>((resolve, reject) => {
        element = new Image()
        element.onload = () => {
          cleanupElement()
          if (element && element.naturalWidth > 0 && element.naturalHeight > 0) resolve(element)
          else reject(new Error('Invalid image dimensions'))
        }
        element.onerror = () => {
          cleanupElement()
          reject(new Error('HTMLImageElement could not decode the image'))
        }
        element.src = sourceUrl
      }),
      { onTimeout: cleanupElement },
    )
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
