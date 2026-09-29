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
      .select('id, location_id, storage_key')
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

    const { error: deleteRowError } = await adminClient
      .rpc('delete_location_image_and_reconcile_cover', {
        p_image_id: typedImageRow.id,
        p_location_id: input.locationId,
      })
      .single()

    if (deleteRowError) {
      throw new HttpError(500, 'Could not delete image metadata.', deleteRowError.message)
    }

    try {
      await deleteCloudflareImage(typedImageRow.storage_key)
    } catch (error) {
      console.warn('[location-image-delete] cloudflare_delete_failed_after_db_delete', {
        event: 'location-image-delete.cloudflare_orphan_possible',
        imageId: typedImageRow.id,
        locationId: input.locationId,
        storageKey: typedImageRow.storage_key,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
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
