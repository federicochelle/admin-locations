import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  getSupabaseClient,
} from '../../lib/supabase'
import { assertSupportedImageFile } from '../images/image-upload.constants'

export type LocationSensitiveContentBoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type LocationSensitiveContentFace = {
  confidence: number | null
  boundingBox: LocationSensitiveContentBoundingBox
}

export type LocationSensitiveContentDetectionResult = {
  faces: LocationSensitiveContentFace[]
  summary: {
    faces: number
  }
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context

    try {
      const payload = await response.json()

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        return payload.error
      }
    } catch {
      try {
        const text = await response.text()

        if (text.trim().length > 0) {
          return text
        }
      } catch {
        return fallbackMessage
      }
    }

    return fallbackMessage
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return error.message
  }

  return getErrorMessage(error, fallbackMessage)
}

export async function detectLocationImageSensitiveContent(
  file: File,
  signal?: AbortSignal,
): Promise<LocationSensitiveContentDetectionResult> {
  assertSupportedImageFile(file)

  const supabase = getSupabaseClient()
  const formData = new FormData()
  formData.set('file', file)

  const { data, error } =
    await supabase.functions.invoke<LocationSensitiveContentDetectionResult>(
      'location-image-detect-sensitive-content',
      {
        body: formData,
        signal,
      },
    )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'No pudimos detectar rostros en la imagen.',
      ),
      {
        cause: error,
      },
    )
  }

  if (!data) {
    throw new Error('No recibimos datos de detección desde la Edge Function.')
  }

  return data
}
