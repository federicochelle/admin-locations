import { assertAdmin } from '../_shared/auth.ts'
import { deleteCloudflareImage } from '../_shared/cloudflare.ts'
import {
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type DeleteRequestBody = {
  locationId?: unknown
}

type ExistingLocationImageRow = {
  id: string
  storage_key: string
}

type DeletedLocationRow = {
  id: string
}

type DeleteLocationResponse = {
  success: true
  deletedLocationId: string
  deletedImagesCount: number
}

function parseRequestBody(body: DeleteRequestBody) {
  const locationId =
    typeof body.locationId === 'string' ? body.locationId.trim() : ''

  if (!locationId) {
    throw new HttpError(400, 'locationId is required.')
  }

  return { locationId }
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

    const { data: imageRows, error: imageRowsError } = await adminClient
      .from('location_images')
      .select('id, storage_key')
      .eq('location_id', input.locationId)
      .order('sort_order', { ascending: true })

    if (imageRowsError) {
      throw new HttpError(
        500,
        'Could not load location images.',
        imageRowsError.message,
      )
    }

    const typedImageRows = (imageRows ?? []) as ExistingLocationImageRow[]

    for (const imageRow of typedImageRows) {
      if (!imageRow.storage_key?.trim()) {
        throw new HttpError(
          500,
          'Location image is missing its Cloudflare storage key.',
          { imageId: imageRow.id },
        )
      }

      await deleteCloudflareImage(imageRow.storage_key)
    }

    const { data: deletedLocation, error: deleteLocationError } = await adminClient
      .from('locations')
      .delete()
      .eq('id', input.locationId)
      .select('id')
      .single()

    if (deleteLocationError) {
      throw new HttpError(
        500,
        'Could not delete location.',
        deleteLocationError.message,
      )
    }

    const typedDeletedLocation = deletedLocation as DeletedLocationRow

    return jsonResponse(
      {
        success: true,
        deletedLocationId: typedDeletedLocation.id,
        deletedImagesCount: typedImageRows.length,
      } satisfies DeleteLocationResponse,
      { status: 200 },
      origin,
    )
  } catch (error) {
    return errorResponse(error, origin)
  }
})
