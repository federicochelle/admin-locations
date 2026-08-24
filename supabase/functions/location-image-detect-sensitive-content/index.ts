import { assertAdmin } from '../_shared/auth.ts'
import {
  annotateImageWithGoogleVision,
  type VisionFaceAnnotation,
} from '../_shared/google-vision.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'

type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

type SensitiveFaceResult = {
  confidence: number | null
  boundingBox: BoundingBox
}

type SensitiveContentDetectionResponse = {
  faces: SensitiveFaceResult[]
  summary: {
    faces: number
  }
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
])

function normalizeCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toBoundingBox(vertices: Array<{ x?: number; y?: number }> | undefined): BoundingBox {
  const normalizedVertices = (vertices ?? []).map((vertex) => ({
    x: normalizeCoordinate(vertex.x),
    y: normalizeCoordinate(vertex.y),
  }))

  if (normalizedVertices.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
  }

  const xs = normalizedVertices.map((vertex) => vertex.x)
  const ys = normalizedVertices.map((vertex) => vertex.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  }
}

function normalizeFace(annotation: VisionFaceAnnotation): SensitiveFaceResult {
  return {
    confidence:
      typeof annotation.detectionConfidence === 'number'
        ? annotation.detectionConfidence
        : null,
    boundingBox: toBoundingBox(annotation.boundingPoly?.vertices),
  }
}

function parseImageFile(formData: FormData) {
  const fileEntry = formData.get('file')

  if (!(fileEntry instanceof File)) {
    throw new HttpError(400, 'file is required.')
  }

  if (fileEntry.size === 0) {
    throw new HttpError(400, 'The uploaded image is empty.')
  }

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(fileEntry.type)) {
    throw new HttpError(
      400,
      'Unsupported image content type for Google Cloud Vision.',
      Array.from(SUPPORTED_IMAGE_MIME_TYPES),
    )
  }

  return fileEntry
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      { status: 405 },
      origin,
    )
  }

  try {
    await assertAdmin(request)

    const formData = await request.formData()
    const file = parseImageFile(formData)
    const visionResponse = await annotateImageWithGoogleVision({
      file,
      features: ['FACE_DETECTION'],
    })

    const faces = (visionResponse.faceAnnotations ?? []).map(normalizeFace)

    return jsonResponse(
      {
        faces,
        summary: {
          faces: faces.length,
        },
      } satisfies SensitiveContentDetectionResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
