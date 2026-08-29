import { assertAdmin } from '../_shared/auth.ts'
import {
  buildCloudflarePublicUrl,
  deleteCloudflareImage,
  getCloudflareImageDetails,
} from '../_shared/cloudflare.ts'
import { errorResponse, handleOptions, HttpError, jsonResponse } from '../_shared/http.ts'
import { assertLocationExists } from '../_shared/locations.ts'

type ReplaceRequestBody = {
  expectedStorageKey?: unknown
  height?: unknown
  imageId?: unknown
  locationId?: unknown
  newCloudflareImageId?: unknown
  width?: unknown
}

type ExistingLocationImageRow = {
  id: string
  location_id: string
  storage_key: string
}

type LocationImageResponse = {
  alt_text: string | null
  caption: string | null
  created_at: string
  height: number | null
  id: string
  is_cover: boolean
  location_id: string
  sort_order: number
  storage_key: string
  updated_at: string
  url: string
  width: number | null
}

function parseRequiredString(value: unknown, name: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    throw new HttpError(400, `${name} is required.`)
  }

  return normalized
}

function parsePositiveDimension(value: unknown, name: 'width' | 'height') {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `${name} must be a positive integer.`)
  }

  return value
}

function parseRequestBody(body: ReplaceRequestBody) {
  const expectedStorageKey = parseRequiredString(
    body.expectedStorageKey,
    'expectedStorageKey',
  )
  const newCloudflareImageId = parseRequiredString(
    body.newCloudflareImageId,
    'newCloudflareImageId',
  )

  if (expectedStorageKey === newCloudflareImageId) {
    throw new HttpError(400, 'The replacement asset must differ from the current asset.')
  }

  return {
    expectedStorageKey,
    height: parsePositiveDimension(body.height, 'height'),
    imageId: parseRequiredString(body.imageId, 'imageId'),
    locationId: parseRequiredString(body.locationId, 'locationId'),
    newCloudflareImageId,
    width: parsePositiveDimension(body.width, 'width'),
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  let newAssetValidated = false
  let swapCompleted = false
  let newCloudflareImageId: string | null = null
  let locationId: string | null = null

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, { status: 405 }, origin)
  }

  try {
    const input = parseRequestBody((await request.json()) as ReplaceRequestBody)
    newCloudflareImageId = input.newCloudflareImageId
    locationId = input.locationId
    const { adminClient } = await assertAdmin(request)

    await assertLocationExists(adminClient, input.locationId)
    await getCloudflareImageDetails(input.newCloudflareImageId)
    newAssetValidated = true

    const { data: existingData, error: existingError } = await adminClient
      .from('location_images')
      .select('id, location_id, storage_key')
      .eq('id', input.imageId)
      .maybeSingle()

    if (existingError) {
      throw new HttpError(500, 'Could not load image metadata.', existingError.message)
    }

    const existingImage = existingData as ExistingLocationImageRow | null

    if (!existingImage) {
      throw new HttpError(404, 'Image not found.')
    }

    if (existingImage.location_id !== input.locationId) {
      throw new HttpError(400, 'Image does not belong to the provided location.')
    }

    if (existingImage.storage_key !== input.expectedStorageKey) {
      throw new HttpError(409, 'The image was modified by another session. Refresh and try again.')
    }

    const { data: updatedData, error: updateError } = await adminClient
      .from('location_images')
      .update({
        height: input.height,
        storage_key: input.newCloudflareImageId,
        updated_at: new Date().toISOString(),
        url: buildCloudflarePublicUrl(input.newCloudflareImageId),
        width: input.width,
      })
      .eq('id', input.imageId)
      .eq('location_id', input.locationId)
      .eq('storage_key', input.expectedStorageKey)
      .select(
        'id, location_id, url, storage_key, alt_text, caption, sort_order, is_cover, width, height, created_at, updated_at',
      )
      .maybeSingle()

    if (updateError) {
      throw new HttpError(500, 'Could not replace image metadata.', updateError.message)
    }

    if (!updatedData) {
      throw new HttpError(409, 'The image was modified by another session. Refresh and try again.')
    }

    swapCompleted = true

    try {
      await deleteCloudflareImage(input.expectedStorageKey)
    } catch (error) {
      console.warn('[location-image-replace] previous_asset_delete_failed', {
        imageId: input.imageId,
        locationId: input.locationId,
        storageKey: input.expectedStorageKey,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return jsonResponse(updatedData as LocationImageResponse, { status: 200 }, origin)
  } catch (error) {
    if (newAssetValidated && !swapCompleted && newCloudflareImageId) {
      try {
        await deleteCloudflareImage(newCloudflareImageId)
      } catch (cleanupError) {
        console.warn('[location-image-replace] replacement_asset_cleanup_failed', {
          locationId,
          storageKey: newCloudflareImageId,
          errorMessage:
            cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
        })
      }
    }

    return errorResponse(error, origin)
  }
})
