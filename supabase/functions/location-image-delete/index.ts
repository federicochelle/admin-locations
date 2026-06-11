import { assertAdmin } from '../_shared/auth.ts'
import { deleteCloudflareImage } from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type DeleteRequestBody = {
  imageId?: unknown
  locationId?: unknown
}

type ExistingLocationImageRow = {
  id: string
  location_id: string
  storage_key: string
  is_cover: boolean
}

type DeleteLocationImageResponse = {
  success: true
}

function parseRequestBody(body: DeleteRequestBody) {
  const locationId =
    typeof body.locationId === 'string' ? body.locationId.trim() : ''
  const imageId = typeof body.imageId === 'string' ? body.imageId.trim() : ''

  if (!locationId) {
    throw new HttpError(400, 'locationId is required.')
  }

  if (!imageId) {
    throw new HttpError(400, 'imageId is required.')
  }

  return {
    imageId,
    locationId,
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
    const body = (await request.json()) as DeleteRequestBody
    const input = parseRequestBody(body)
    const { adminClient } = await assertAdmin(request)

    await assertLocationExists(adminClient, input.locationId)

    const { data: imageRow, error: imageError } = await adminClient
      .from('location_images')
      .select('id, location_id, storage_key, is_cover')
      .eq('id', input.imageId)
      .maybeSingle()

    if (imageError) {
      throw new HttpError(500, 'Could not load image metadata.', imageError.message)
    }

    const typedImageRow = imageRow as ExistingLocationImageRow | null

    if (!typedImageRow) {
      throw new HttpError(404, 'Image not found.')
    }

    if (typedImageRow.location_id !== input.locationId) {
      throw new HttpError(400, 'Image does not belong to the provided location.')
    }

    await deleteCloudflareImage(typedImageRow.storage_key)

    const { error: deleteRowError } = await adminClient
      .from('location_images')
      .delete()
      .eq('id', typedImageRow.id)

    if (deleteRowError) {
      throw new HttpError(500, 'Could not delete image metadata.', deleteRowError.message)
    }

    return jsonResponse(
      { success: true } satisfies DeleteLocationImageResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
