import { assertAdmin } from '../_shared/auth.ts'
import {
  assertAllowedContentType,
  createDirectUploadUrl,
} from '../_shared/cloudflare.ts'
import { handleOptions, HttpError, jsonResponse, errorResponse } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type UploadUrlRequestBody = {
  contentType?: unknown
  filename?: unknown
  locationId?: unknown
}

function parseRequestBody(body: UploadUrlRequestBody) {
  const locationId =
    typeof body.locationId === 'string' ? body.locationId.trim() : ''
  const filename =
    typeof body.filename === 'string' ? body.filename.trim() : ''
  const contentType =
    typeof body.contentType === 'string' ? body.contentType.trim() : ''

  if (!locationId) {
    throw new HttpError(400, 'locationId is required.')
  }

  if (!filename) {
    throw new HttpError(400, 'filename is required.')
  }

  if (!contentType) {
    throw new HttpError(400, 'contentType is required.')
  }

  assertAllowedContentType(contentType)

  return {
    locationId,
    filename,
    contentType,
  }
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
    const body = (await request.json()) as UploadUrlRequestBody
    const input = parseRequestBody(body)

    const { adminClient, user } = await assertAdmin(request)

    await assertLocationExists(adminClient, input.locationId)

    const cloudflareResult = await createDirectUploadUrl({
      contentType: input.contentType,
      filename: input.filename,
      locationId: input.locationId,
      userId: user.id,
    })

    return jsonResponse(
      {
        uploadURL: cloudflareResult.uploadURL ?? null,
        imageId: cloudflareResult.id ?? null,
        cloudflare: cloudflareResult,
      },
      { status: 200 },
      origin,
    )
  } catch (error) {
    if (error instanceof HttpError) {
      console.error('[location-image-upload-url] request_failed', {
        details: error.details ?? null,
        message: error.message,
        status: error.status,
      })
    } else if (error instanceof Error) {
      console.error('[location-image-upload-url] request_failed', {
        message: error.message,
        name: error.name,
        stack: error.stack ?? null,
      })

      return jsonResponse(
        {
          details: {
            name: error.name,
            stack: error.stack ?? null,
          },
          error: error.message,
        },
        { status: 500 },
        origin,
      )
    } else {
      console.error('[location-image-upload-url] request_failed', {
        message: 'Unknown error',
      })
    }

    return errorResponse(error, origin)
  }
})
