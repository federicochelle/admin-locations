import { assertAdmin } from '../_shared/auth.ts'
import { getCloudflareImageBlob } from '../_shared/cloudflare.ts'
import { errorResponse, getCorsHeaders, handleOptions, HttpError } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type SourceRequestBody = {
  imageId?: unknown
  locationId?: unknown
}

type ExistingLocationImageRow = {
  id: string
  location_id: string
  storage_key: string
}

function parseRequestBody(body: SourceRequestBody) {
  const imageId = typeof body.imageId === 'string' ? body.imageId.trim() : ''
  const locationId =
    typeof body.locationId === 'string' ? body.locationId.trim() : ''

  if (!locationId) {
    throw new HttpError(400, 'locationId is required.')
  }

  if (!imageId) {
    throw new HttpError(400, 'imageId is required.')
  }

  return { imageId, locationId }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      status: 405,
    })
  }

  try {
    const input = parseRequestBody((await request.json()) as SourceRequestBody)
    const { adminClient } = await assertAdmin(request)

    await assertLocationExists(adminClient, input.locationId)

    const { data, error } = await adminClient
      .from('location_images')
      .select('id, location_id, storage_key')
      .eq('id', input.imageId)
      .maybeSingle()

    if (error) {
      throw new HttpError(500, 'Could not load image metadata.', error.message)
    }

    const image = data as ExistingLocationImageRow | null

    if (!image) {
      throw new HttpError(404, 'Image not found.')
    }

    if (image.location_id !== input.locationId) {
      throw new HttpError(400, 'Image does not belong to the provided location.')
    }

    if (!image.storage_key.trim()) {
      throw new HttpError(500, 'Image is missing its Cloudflare storage key.')
    }

    const source = await getCloudflareImageBlob(image.storage_key)

    return new Response(source.blob, {
      headers: {
        ...getCorsHeaders(origin),
        'Access-Control-Expose-Headers': 'X-Image-Content-Type',
        'Content-Type': 'application/octet-stream',
        'X-Image-Content-Type': source.contentType,
      },
      status: 200,
    })
  } catch (error) {
    return errorResponse(error, origin)
  }
})
