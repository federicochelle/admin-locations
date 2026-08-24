import { getRequiredEnv } from './env.ts'
import { HttpError } from './http.ts'

type VisionFeatureType = 'FACE_DETECTION' | 'TEXT_DETECTION'

type VisionAnnotateRequest = {
  image: {
    content: string
  }
  features: Array<{
    maxResults?: number
    type: VisionFeatureType
  }>
}

type VisionErrorPayload = {
  code?: number
  details?: unknown
  message?: string
  status?: string
}

type VisionVertex = {
  x?: number
  y?: number
}

type VisionBoundingPoly = {
  vertices?: VisionVertex[]
}

export type VisionFaceAnnotation = {
  boundingPoly?: VisionBoundingPoly
  detectionConfidence?: number
}

export type VisionTextAnnotation = {
  boundingPoly?: VisionBoundingPoly
  description?: string
}

type VisionAnnotateImageResponse = {
  error?: VisionErrorPayload
  faceAnnotations?: VisionFaceAnnotation[]
  textAnnotations?: VisionTextAnnotation[]
}

type VisionAnnotateApiResponse = {
  responses?: VisionAnnotateImageResponse[]
}

function getVisionApiKey() {
  return getRequiredEnv('GOOGLE_CLOUD_VISION_API_KEY')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function getVisionApiUrl() {
  return `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(getVisionApiKey())}`
}

function getVisionErrorMessage(payload: VisionAnnotateApiResponse | null) {
  const firstError = payload?.responses?.[0]?.error

  if (firstError?.message?.trim()) {
    return firstError.message.trim()
  }

  return 'Google Cloud Vision returned an unexpected error.'
}

export async function annotateImageWithGoogleVision(input: {
  features: VisionFeatureType[]
  file: File
}) {
  const fileBytes = new Uint8Array(await input.file.arrayBuffer())

  if (fileBytes.byteLength === 0) {
    throw new HttpError(400, 'The uploaded image is empty.')
  }

  const requestBody: {
    requests: VisionAnnotateRequest[]
  } = {
    requests: [
      {
        image: {
          content: bytesToBase64(fileBytes),
        },
        features: input.features.map((type) => ({
          type,
        })),
      },
    ],
  }

  let response: Response

  try {
    response = await fetch(getVisionApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    throw new HttpError(502, 'Could not reach Google Cloud Vision.', {
      errorMessage: error instanceof Error ? error.message : 'Unknown network error.',
    })
  }

  const rawText = await response.text()
  let payload: VisionAnnotateApiResponse | null = null

  if (rawText.trim().length > 0) {
    try {
      payload = JSON.parse(rawText) as VisionAnnotateApiResponse
    } catch {
      throw new HttpError(502, 'Google Cloud Vision returned a non-JSON response.', {
        upstreamStatus: response.status,
        upstreamStatusText: response.statusText,
      })
    }
  }

  if (!response.ok) {
    throw new HttpError(502, getVisionErrorMessage(payload), {
      upstreamStatus: response.status,
      upstreamStatusText: response.statusText,
      visionError: payload?.responses?.[0]?.error ?? null,
    })
  }

  const annotationResponse = payload?.responses?.[0]

  if (!annotationResponse) {
    throw new HttpError(502, 'Google Cloud Vision did not return annotations.')
  }

  if (annotationResponse.error) {
    throw new HttpError(502, getVisionErrorMessage(payload), {
      visionError: annotationResponse.error,
    })
  }

  return annotationResponse
}
